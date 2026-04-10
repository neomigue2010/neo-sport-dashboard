import { NextRequest, NextResponse } from 'next/server';
import { getPool, hasDatabase } from '@/lib/db';

async function ensureTimerTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rest_timers (
      user_slug TEXT PRIMARY KEY,
      duration_seconds INTEGER NOT NULL DEFAULT 90,
      remaining_seconds INTEGER NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'finished')),
      end_at TIMESTAMPTZ,
      finish_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE rest_timers ADD COLUMN IF NOT EXISTS finish_count INTEGER NOT NULL DEFAULT 0`);
}

async function ensureTimerRow(userSlug: string) {
  const pool = getPool();
  await ensureTimerTable();
  await pool.query(
    `
      INSERT INTO rest_timers (user_slug, duration_seconds, remaining_seconds, status)
      VALUES ($1, 90, 90, 'idle')
      ON CONFLICT (user_slug) DO NOTHING
    `,
    [userSlug]
  );
}

async function getTimerState(userSlug: string) {
  const pool = getPool();
  await ensureTimerRow(userSlug);

  const result = await pool.query(
    `
      SELECT user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
      FROM rest_timers
      WHERE user_slug = $1
    `,
    [userSlug]
  );

  const row = result.rows[0];
  const now = new Date();

  if (row.status === 'running' && row.end_at) {
    const endAt = new Date(row.end_at);
    const diffSeconds = Math.max(0, Math.ceil((endAt.getTime() - now.getTime()) / 1000));

    if (diffSeconds <= 0) {
      const updated = await pool.query(
        `
          UPDATE rest_timers
          SET status = 'finished', remaining_seconds = 0, end_at = NULL, finish_count = finish_count + 1, updated_at = now()
          WHERE user_slug = $1
          RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
        `,
        [userSlug]
      );
      return { ...updated.rows[0], server_now: now.toISOString() };
    }

    return {
      ...row,
      remaining_seconds: diffSeconds,
      server_now: now.toISOString()
    };
  }

  return {
    ...row,
    server_now: now.toISOString()
  };
}

export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get('user') || 'migue';

  if (!hasDatabase()) {
    return NextResponse.json({ ok: false, message: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    const timer = await getTimerState(user);
    return NextResponse.json({ ok: true, timer });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unknown timer error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ ok: false, message: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const user = body.user || 'migue';
    const action = body.action;
    const pool = getPool();
    await ensureTimerRow(user);

    if (action === 'preset') {
      const seconds = Math.max(5, Number(body.seconds) || 90);
      const result = await pool.query(
        `
          UPDATE rest_timers
          SET duration_seconds = $2,
              remaining_seconds = $2,
              status = 'idle',
              end_at = NULL,
              updated_at = now()
          WHERE user_slug = $1
          RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
        `,
        [user, seconds]
      );
      return NextResponse.json({ ok: true, timer: { ...result.rows[0], server_now: new Date().toISOString() } });
    }

    if (action === 'start') {
      const current = await getTimerState(user);
      const seconds = current.remaining_seconds > 0 ? current.remaining_seconds : current.duration_seconds;
      const result = await pool.query(
        `
          UPDATE rest_timers
          SET remaining_seconds = $2,
              status = 'running',
              end_at = now() + ($2 || ' seconds')::interval,
              updated_at = now()
          WHERE user_slug = $1
          RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
        `,
        [user, seconds]
      );
      return NextResponse.json({ ok: true, timer: { ...result.rows[0], server_now: new Date().toISOString() } });
    }

    if (action === 'pause') {
      const current = await getTimerState(user);
      const remaining = Math.max(0, Number(current.remaining_seconds) || 0);
      const nextStatus = remaining === 0 ? 'finished' : 'paused';
      const result = await pool.query(
        `
          UPDATE rest_timers
          SET remaining_seconds = $2,
              status = $3,
              end_at = NULL,
              updated_at = now()
          WHERE user_slug = $1
          RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
        `,
        [user, remaining, nextStatus]
      );
      return NextResponse.json({ ok: true, timer: { ...result.rows[0], server_now: new Date().toISOString() } });
    }

    if (action === 'reset') {
      const current = await getTimerState(user);
      const wasFinished = String(current.status || '') === 'finished';
      const result = await pool.query(
        `
          UPDATE rest_timers
          SET remaining_seconds = duration_seconds,
              status = 'idle',
              end_at = NULL,
              updated_at = now()
          WHERE user_slug = $1
          RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
        `,
        [user]
      );
      return NextResponse.json({
        ok: true,
        timer: {
          ...result.rows[0],
          server_now: new Date().toISOString(),
          previous_status: current.status,
          alarm_on_reset: wasFinished
        }
      });
    }

    return NextResponse.json({ ok: false, message: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unknown timer error' },
      { status: 500 }
    );
  }
}
