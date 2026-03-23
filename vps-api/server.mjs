import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const PORT = Number(process.env.PORT || 8790);
const DATABASE_URL = process.env.DATABASE_URL;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean);

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.use(cors({ origin: CORS_ORIGIN.length ? CORS_ORIGIN : true, credentials: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    const db = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM app_users) AS users,
        (SELECT COUNT(*)::int FROM workout_days) AS workout_days,
        (SELECT COUNT(*)::int FROM workout_sessions) AS workout_sessions,
        (SELECT COUNT(*)::int FROM exercise_catalog) AS exercise_catalog,
        (SELECT COUNT(*)::int FROM routine_templates) AS routine_templates
    `);

    res.json({ ok: true, counts: db.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'unknown error' });
  }
});

app.get('/api/calendar', async (req, res) => {
  const slug = String(req.query.user || 'migue');
  const month = String(req.query.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ ok: false, message: 'month must be YYYY-MM' });
  }

  try {
    const result = await pool.query(
      `SELECT wd.training_date, wd.status, wd.focus, wd.notes
       FROM workout_days wd
       JOIN app_users u ON u.id = wd.user_id
       WHERE u.slug = $1
         AND to_char(wd.training_date, 'YYYY-MM') = $2
       ORDER BY wd.training_date ASC`,
      [slug, month]
    );
    res.json({ ok: true, days: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'unknown error' });
  }
});

app.post('/api/calendar/day', async (req, res) => {
  const { user = 'migue', trainingDate, status = 'planned', focus = null, notes = null } = req.body || {};
  if (!trainingDate) {
    return res.status(400).json({ ok: false, message: 'trainingDate is required' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM app_users WHERE slug = $1 LIMIT 1', [user]);
    if (!userResult.rowCount) {
      return res.status(404).json({ ok: false, message: 'user not found' });
    }

    const userId = userResult.rows[0].id;
    const result = await pool.query(
      `INSERT INTO workout_days (user_id, training_date, status, focus, notes)
       VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (user_id, training_date)
       DO UPDATE SET status = EXCLUDED.status, focus = EXCLUDED.focus, notes = EXCLUDED.notes, updated_at = now()
       RETURNING *`,
      [userId, trainingDate, status, focus, notes]
    );

    res.json({ ok: true, day: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'unknown error' });
  }
});

app.post('/api/session/complete', async (req, res) => {
  const {
    user = 'migue',
    trainingDate,
    startedAt = null,
    completedAt = new Date().toISOString(),
    durationMinutes = null,
    perceivedEnergy = null,
    perceivedEffort = null,
    notes = null
  } = req.body || {};

  if (!trainingDate) {
    return res.status(400).json({ ok: false, message: 'trainingDate is required' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM app_users WHERE slug = $1 LIMIT 1', [user]);
    if (!userResult.rowCount) {
      return res.status(404).json({ ok: false, message: 'user not found' });
    }

    const userId = userResult.rows[0].id;
    const dayResult = await pool.query(
      `INSERT INTO workout_days (user_id, training_date, status)
       VALUES ($1, $2::date, 'done')
       ON CONFLICT (user_id, training_date)
       DO UPDATE SET status = 'done', updated_at = now()
       RETURNING *`,
      [userId, trainingDate]
    );

    const sessionResult = await pool.query(
      `INSERT INTO workout_sessions (
          workout_day_id, started_at, completed_at, duration_minutes,
          perceived_energy, perceived_effort, notes, coach_summary
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (workout_day_id)
       DO UPDATE SET
         started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at,
         duration_minutes = EXCLUDED.duration_minutes,
         perceived_energy = EXCLUDED.perceived_energy,
         perceived_effort = EXCLUDED.perceived_effort,
         notes = EXCLUDED.notes,
         coach_summary = EXCLUDED.coach_summary,
         updated_at = now()
       RETURNING *`,
      [
        dayResult.rows[0].id,
        startedAt,
        completedAt,
        durationMinutes,
        perceivedEnergy,
        perceivedEffort,
        notes,
        'PENDIENTE_NEO'
      ]
    );

    // Intencionadamente NO analizamos aqui. Solo dejamos la sesion cerrada y marcada para Neo.
    res.json({
      ok: true,
      day: dayResult.rows[0],
      session: sessionResult.rows[0],
      analysis: {
        status: 'pending_neo',
        message: 'Sesión cerrada y pendiente de análisis por Neo.'
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`neo-sport-api listening on ${PORT}`);
});
