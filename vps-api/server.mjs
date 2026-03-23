import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const PORT = Number(process.env.PORT || 8790);
const DATABASE_URL = process.env.DATABASE_URL;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean);

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.use(cors({ origin: CORS_ORIGIN.length ? CORS_ORIGIN : true, credentials: false }));
app.use(express.json({ limit: '1mb' }));

async function getUserId(slug = 'migue') {
  const result = await pool.query('SELECT id FROM app_users WHERE slug = $1 LIMIT 1', [slug]);
  if (!result.rowCount) throw new Error('user not found');
  return result.rows[0].id;
}

async function getOrCreateDay(userId, trainingDate, status = 'planned') {
  const result = await pool.query(
    `INSERT INTO workout_days (user_id, training_date, status)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (user_id, training_date)
     DO UPDATE SET updated_at = now()
     RETURNING *`,
    [userId, trainingDate, status]
  );
  return result.rows[0];
}

async function getOrCreateSession(workoutDayId) {
  const existing = await pool.query('SELECT * FROM workout_sessions WHERE workout_day_id = $1 LIMIT 1', [workoutDayId]);
  if (existing.rowCount) return existing.rows[0];
  const created = await pool.query(
    `INSERT INTO workout_sessions (workout_day_id, coach_summary)
     VALUES ($1, 'PENDIENTE_NEO')
     RETURNING *`,
    [workoutDayId]
  );
  return created.rows[0];
}

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
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ ok: false, message: 'month must be YYYY-MM' });

  try {
    const result = await pool.query(
      `SELECT wd.training_date, wd.status, wd.focus, wd.notes
       FROM workout_days wd
       JOIN app_users u ON u.id = wd.user_id
       WHERE u.slug = $1 AND to_char(wd.training_date, 'YYYY-MM') = $2
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
  if (!trainingDate) return res.status(400).json({ ok: false, message: 'trainingDate is required' });

  try {
    const userId = await getUserId(user);
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
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/session', async (req, res) => {
  const user = String(req.query.user || 'migue');
  const trainingDate = String(req.query.trainingDate || '').trim();
  if (!trainingDate) return res.status(400).json({ ok: false, message: 'trainingDate is required' });

  try {
    const userId = await getUserId(user);
    const dayResult = await pool.query(
      `SELECT * FROM workout_days WHERE user_id = $1 AND training_date = $2::date LIMIT 1`,
      [userId, trainingDate]
    );

    if (!dayResult.rowCount) return res.json({ ok: true, day: null, session: null, exercises: [] });

    const day = dayResult.rows[0];
    const sessionResult = await pool.query('SELECT * FROM workout_sessions WHERE workout_day_id = $1 LIMIT 1', [day.id]);
    const session = sessionResult.rowCount ? sessionResult.rows[0] : null;

    let exercises = [];
    if (session) {
      const exerciseResult = await pool.query(
        `SELECT wse.*, es.reps, es.weight_kg, es.effort AS set_effort, es.notes AS set_notes
         FROM workout_session_exercises wse
         LEFT JOIN exercise_sets es ON es.session_exercise_id = wse.id AND es.set_number = 1
         WHERE wse.session_id = $1
         ORDER BY wse.sort_order ASC`,
        [session.id]
      );
      exercises = exerciseResult.rows;
    }

    res.json({ ok: true, day, session, exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/session/exercise', async (req, res) => {
  const {
    user = 'migue',
    trainingDate,
    exerciseName,
    sortOrder = 0,
    targetSets = null,
    targetReps = null,
    targetNotes = null,
    actualNotes = null,
    difficulty = null,
    reps = null,
    weightKg = null,
    effort = null
  } = req.body || {};

  if (!trainingDate || !exerciseName) {
    return res.status(400).json({ ok: false, message: 'trainingDate and exerciseName are required' });
  }

  try {
    const userId = await getUserId(user);
    const day = await getOrCreateDay(userId, trainingDate, 'planned');
    const session = await getOrCreateSession(day.id);

    const exerciseResult = await pool.query(
      `INSERT INTO workout_session_exercises (
         session_id, exercise_name, sort_order, target_sets, target_reps, target_notes, actual_notes, difficulty
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [session.id, exerciseName, sortOrder, targetSets, targetReps, targetNotes, actualNotes, difficulty]
    );

    let sessionExercise = exerciseResult.rows[0];
    if (!sessionExercise) {
      const existing = await pool.query(
        `SELECT * FROM workout_session_exercises WHERE session_id = $1 AND sort_order = $2 LIMIT 1`,
        [session.id, sortOrder]
      );
      sessionExercise = existing.rows[0];
      sessionExercise = (
        await pool.query(
          `UPDATE workout_session_exercises
           SET exercise_name = $2, target_sets = $3, target_reps = $4, target_notes = $5, actual_notes = $6, difficulty = $7, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [sessionExercise.id, exerciseName, targetSets, targetReps, targetNotes, actualNotes, difficulty]
        )
      ).rows[0];
    }

    const setResult = await pool.query(
      `INSERT INTO exercise_sets (session_exercise_id, set_number, reps, weight_kg, effort, notes)
       VALUES ($1, 1, $2, $3, $4, $5)
       ON CONFLICT (session_exercise_id, set_number)
       DO UPDATE SET reps = EXCLUDED.reps, weight_kg = EXCLUDED.weight_kg, effort = EXCLUDED.effort, notes = EXCLUDED.notes
       RETURNING *`,
      [sessionExercise.id, reps, weightKg, effort, actualNotes]
    );

    res.json({ ok: true, exercise: sessionExercise, firstSet: setResult.rows[0], session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
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

  if (!trainingDate) return res.status(400).json({ ok: false, message: 'trainingDate is required' });

  try {
    const userId = await getUserId(user);
    const day = await getOrCreateDay(userId, trainingDate, 'done');
    const session = await getOrCreateSession(day.id);

    const sessionResult = await pool.query(
      `UPDATE workout_sessions
       SET started_at = COALESCE($2, started_at),
           completed_at = $3,
           duration_minutes = $4,
           perceived_energy = $5,
           perceived_effort = $6,
           notes = $7,
           coach_summary = 'PENDIENTE_NEO',
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [session.id, startedAt, completedAt, durationMinutes, perceivedEnergy, perceivedEffort, notes]
    );

    await pool.query(`UPDATE workout_days SET status = 'done', updated_at = now() WHERE id = $1`, [day.id]);

    res.json({
      ok: true,
      day: { ...day, status: 'done' },
      session: sessionResult.rows[0],
      analysis: { status: 'pending_neo', message: 'Sesión cerrada y pendiente de análisis por Neo.' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.listen(PORT, () => {
  console.log(`neo-sport-api listening on ${PORT}`);
});
