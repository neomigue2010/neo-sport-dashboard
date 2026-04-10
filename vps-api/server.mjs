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
     DO UPDATE SET status = EXCLUDED.status, updated_at = now()
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
     VALUES ($1, 'BORRADOR')
     RETURNING *`,
    [workoutDayId]
  );
  return created.rows[0];
}

async function fetchSessionBundleBySessionId(sessionId) {
  const sessionResult = await pool.query(
    `SELECT ws.*, wd.training_date, wd.status AS day_status, wd.focus, wd.notes AS day_notes, u.slug AS user_slug, u.display_name
     FROM workout_sessions ws
     JOIN workout_days wd ON wd.id = ws.workout_day_id
     JOIN app_users u ON u.id = wd.user_id
     WHERE ws.id = $1
     LIMIT 1`,
    [sessionId]
  );
  if (!sessionResult.rowCount) return null;

  const session = sessionResult.rows[0];
  const exerciseResult = await pool.query(
    `SELECT wse.*, es.reps, es.weight_kg, es.effort AS set_effort, es.notes AS set_notes
     FROM workout_session_exercises wse
     LEFT JOIN exercise_sets es ON es.session_exercise_id = wse.id AND es.set_number = 1
     WHERE wse.session_id = $1
     ORDER BY wse.sort_order ASC`,
    [sessionId]
  );

  return { session, exercises: exerciseResult.rows };
}

function normalizeExerciseGhostKey(exerciseName = '') {
  const normalized = String(exerciseName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (normalized.includes('press pecho inclinado')) return 'press-pecho-inclinado';
  if (normalized.includes('press pecho en maquina')) return 'press-pecho-maquina';
  if (normalized.includes('prensa inclinada')) return 'prensa-inclinada';
  if (normalized.includes('prensa de piernas')) return 'prensa-piernas';
  if (normalized === 'prensa') return 'prensa-piernas';
  if (normalized.includes('jalon al pecho')) return 'jalon-pecho';
  if (normalized.includes('press pecho')) return 'press-pecho';
  if (normalized.includes('curl femoral')) return 'curl-femoral';
  if (normalized.includes('plancha')) return 'plancha';
  if (normalized.includes('sentadilla guiada')) return 'sentadilla-guiada';
  if (normalized.includes('sentadilla goblet')) return 'sentadilla-goblet';
  if (normalized.includes('remo sentado') || normalized.includes('remo bajo en polea')) return 'remo-horizontal';
  if (normalized.includes('elevaciones laterales')) return 'elevaciones-laterales';
  if (normalized.includes('curl biceps')) return 'curl-biceps';
  if (normalized.includes('peso muerto rumano')) return 'pm-rumano';
  if (normalized.includes('dead bug')) return 'dead-bug';
  if (normalized.includes('face pull')) return 'face-pull';

  return normalized;
}

function mapPreviousReference(previous) {
  return previous
    ? {
        ...previous,
        weight_kg: previous.weight_kg != null ? Number(previous.weight_kg) : null,
        reps: previous.reps != null ? Number(previous.reps) : null,
        actual_sets: previous.actual_sets != null ? Number(previous.actual_sets) : null,
        actual_duration_minutes: previous.actual_duration_minutes != null ? Number(previous.actual_duration_minutes) : null,
        actual_distance_km: previous.actual_distance_km != null ? Number(previous.actual_distance_km) : null,
        actual_calories_burned: previous.actual_calories_burned != null ? Number(previous.actual_calories_burned) : null,
        difficulty: previous.difficulty != null ? Number(previous.difficulty) : null
      }
    : null;
}

async function fetchSessionExercisesWithReferences(sessionId, userId, trainingDate) {
  const exerciseResult = await pool.query(
    `SELECT wse.*, es.reps, es.weight_kg, es.effort AS set_effort, es.notes AS set_notes
     FROM workout_session_exercises wse
     LEFT JOIN exercise_sets es ON es.session_exercise_id = wse.id AND es.set_number = 1
     WHERE wse.session_id = $1
     ORDER BY wse.sort_order ASC`,
    [sessionId]
  );

  return Promise.all(
    exerciseResult.rows.map(async (exercise) => {
      const previous = exercise.exercise_name
        ? await fetchPreviousExerciseReference(userId, trainingDate, exercise.exercise_name)
        : null;
      return { ...exercise, previous_reference: mapPreviousReference(previous) };
    })
  );
}

async function fetchPreviousExerciseReference(userId, trainingDate, exerciseName) {
  const targetKey = normalizeExerciseGhostKey(exerciseName);
  if (!targetKey) return null;

  const result = await pool.query(
    `SELECT
       wd.training_date,
       wse.exercise_name,
       wse.exercise_type,
       wse.actual_sets,
       wse.actual_calories_burned,
       wse.actual_duration_minutes,
       wse.actual_distance_km,
       es.reps,
       es.weight_kg,
       COALESCE(wse.difficulty, es.effort) AS difficulty,
       COALESCE(wse.actual_notes, es.notes) AS notes
     FROM workout_session_exercises wse
     JOIN workout_sessions ws ON ws.id = wse.session_id
     JOIN workout_days wd ON wd.id = ws.workout_day_id
     LEFT JOIN exercise_sets es ON es.session_exercise_id = wse.id AND es.set_number = 1
     WHERE wd.user_id = $1
       AND wd.training_date < $2::date
       AND wse.is_logged = true
       AND (
         wse.actual_sets IS NOT NULL
         OR wse.actual_duration_minutes IS NOT NULL
         OR wse.actual_distance_km IS NOT NULL
         OR wse.actual_calories_burned IS NOT NULL
         OR es.reps IS NOT NULL
         OR es.weight_kg IS NOT NULL
       )
     ORDER BY wd.training_date DESC, ws.completed_at DESC NULLS LAST, wse.updated_at DESC`,
    [userId, trainingDate]
  );

  const match = result.rows.find((row) => normalizeExerciseGhostKey(row.exercise_name) === targetKey);
  return match || null;
}

async function ensureRestTimerTable() {
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

async function ensureRestTimerRow(userSlug = 'migue') {
  await ensureRestTimerTable();
  await pool.query(
    `INSERT INTO rest_timers (user_slug, duration_seconds, remaining_seconds, status)
     VALUES ($1, 90, 90, 'idle')
     ON CONFLICT (user_slug) DO NOTHING`,
    [userSlug]
  );
}

async function getRestTimerState(userSlug = 'migue') {
  await ensureRestTimerRow(userSlug);

  const result = await pool.query(
    `SELECT user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at
     FROM rest_timers
     WHERE user_slug = $1`,
    [userSlug]
  );

  const row = result.rows[0];
  const now = new Date();

  if (row.status === 'running' && row.end_at) {
    const endAt = new Date(row.end_at);
    const diffSeconds = Math.max(0, Math.ceil((endAt.getTime() - now.getTime()) / 1000));

    if (diffSeconds <= 0) {
      const updated = await pool.query(
        `UPDATE rest_timers
         SET status = 'finished', remaining_seconds = 0, end_at = NULL, finish_count = finish_count + 1, updated_at = now()
         WHERE user_slug = $1
         RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at`,
        [userSlug]
      );
      return { ...updated.rows[0], server_now: now.toISOString() };
    }

    return { ...row, remaining_seconds: diffSeconds, server_now: now.toISOString() };
  }

  return { ...row, server_now: now.toISOString() };
}

async function ensureWorkoutExerciseExtras() {
  await pool.query(`ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'strength'`);
  await pool.query(`ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER`);
  await pool.query(`ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS actual_distance_km NUMERIC(6,2)`);
  await pool.query(`ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS actual_calories_burned NUMERIC(8,2)`);
  await pool.query(`ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false`);
}

async function ensureNeoWakeTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS neo_wake_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL DEFAULT 'session_complete',
      session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
      training_date DATE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      acked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_neo_wake_events_user_created ON neo_wake_events(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_neo_wake_events_pending ON neo_wake_events(user_id, acked_at, created_at DESC)`);
}

async function createNeoWakeEvent({ userId, sessionId = null, trainingDate = null, eventType = 'session_complete', payload = {} }) {
  await ensureNeoWakeTable();
  const result = await pool.query(
    `INSERT INTO neo_wake_events (user_id, event_type, session_id, training_date, payload)
     VALUES ($1, $2, $3, $4::date, $5::jsonb)
     RETURNING *`,
    [userId, eventType, sessionId, trainingDate, JSON.stringify(payload || {})]
  );
  return result.rows[0];
}

async function ensureNutritionTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nutrition_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, entry_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nutrition_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nutrition_day_id UUID NOT NULL REFERENCES nutrition_days(id) ON DELETE CASCADE,
      meal_type TEXT,
      title TEXT NOT NULL,
      quantity_text TEXT,
      calories NUMERIC(8,2) NOT NULL DEFAULT 0,
      protein_g NUMERIC(8,2) NOT NULL DEFAULT 0,
      carbs_g NUMERIC(8,2) NOT NULL DEFAULT 0,
      fat_g NUMERIC(8,2) NOT NULL DEFAULT 0,
      fiber_g NUMERIC(8,2),
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_name TEXT,
      source_url TEXT,
      source_note TEXT,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`ALTER TABLE nutrition_entries ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nutrition_days_user_date ON nutrition_days(user_id, entry_date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nutrition_entries_day ON nutrition_entries(nutrition_day_id, created_at ASC)`);
}

async function getOrCreateNutritionDay(userId, entryDate) {
  await ensureNutritionTables();
  const result = await pool.query(
    `INSERT INTO nutrition_days (user_id, entry_date)
     VALUES ($1, $2::date)
     ON CONFLICT (user_id, entry_date)
     DO UPDATE SET updated_at = now()
     RETURNING *`,
    [userId, entryDate]
  );
  return result.rows[0];
}

async function fetchNutritionDay(userSlug = 'migue', entryDate) {
  await ensureNutritionTables();
  const userId = await getUserId(userSlug);
  const day = await getOrCreateNutritionDay(userId, entryDate);
  const entriesResult = await pool.query(
    `SELECT id, meal_type, title, quantity_text, calories, protein_g, carbs_g, fat_g, fiber_g, items_json, source_name, source_url, source_note, consumed_at, created_at, updated_at
     FROM nutrition_entries
     WHERE nutrition_day_id = $1
     ORDER BY COALESCE(consumed_at, created_at) ASC, created_at ASC`,
    [day.id]
  );
  const totals = entriesResult.rows.reduce(
    (acc, row) => ({
      calories: acc.calories + Number(row.calories || 0),
      protein_g: acc.protein_g + Number(row.protein_g || 0),
      carbs_g: acc.carbs_g + Number(row.carbs_g || 0),
      fat_g: acc.fat_g + Number(row.fat_g || 0),
      fiber_g: acc.fiber_g + Number(row.fiber_g || 0)
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );

  return { day, entries: entriesResult.rows, totals };
}

async function ensureTrainingReviewTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      review_type TEXT NOT NULL DEFAULT 'scheduled',
      window_days INTEGER NOT NULL DEFAULT 7,
      tracked_days INTEGER NOT NULL DEFAULT 0,
      sessions_count INTEGER NOT NULL DEFAULT 0,
      avg_calories NUMERIC(10,2) NOT NULL DEFAULT 0,
      avg_protein_g NUMERIC(10,2) NOT NULL DEFAULT 0,
      avg_carbs_g NUMERIC(10,2) NOT NULL DEFAULT 0,
      avg_fat_g NUMERIC(10,2) NOT NULL DEFAULT 0,
      avg_energy NUMERIC(10,2),
      avg_effort NUMERIC(10,2),
      recommendation_level TEXT NOT NULL DEFAULT 'info',
      summary TEXT NOT NULL,
      adjustments JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_reviews_user_created ON training_reviews(user_id, created_at DESC)`);
}

async function ensureBodyMetricsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS body_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      weight_kg NUMERIC(6,2),
      goal_weight_kg NUMERIC(6,2),
      height_cm NUMERIC(6,2),
      age_years INTEGER,
      sex TEXT,
      activity_level TEXT,
      body_fat_pct NUMERIC(5,2),
      bmi NUMERIC(6,2),
      bmr_kcal NUMERIC(8,2),
      tdee_kcal NUMERIC(8,2),
      note TEXT,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_body_metrics_user_measured ON body_metrics(user_id, measured_at DESC)`);
}

async function ensureNeoDayNotesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS neo_day_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      note_date DATE NOT NULL,
      slot_key TEXT NOT NULL,
      note_type TEXT NOT NULL DEFAULT 'scheduled_checkin',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tone TEXT NOT NULL DEFAULT 'neutral',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, note_date, slot_key)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_neo_day_notes_user_date ON neo_day_notes(user_id, note_date DESC, created_at DESC)`);
}

async function ensureWeeklyProgrammingReviewsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_programming_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      week_start_date DATE NOT NULL,
      week_end_date DATE NOT NULL,
      review_scope TEXT NOT NULL DEFAULT 'weekly',
      block_phase TEXT,
      source_window_days INTEGER NOT NULL DEFAULT 21,
      summary TEXT NOT NULL,
      changes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      recommendations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      sent_message TEXT,
      sent_to_telegram_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_weekly_programming_reviews_user_week ON weekly_programming_reviews(user_id, week_start_date DESC, created_at DESC)`);
}

function calculateBodyStats({ weightKg = null, goalWeightKg = null, heightCm = null, ageYears = null, sex = null, activityLevel = null }) {
  const heightM = heightCm ? Number(heightCm) / 100 : null;
  const bmi = heightM && weightKg ? Number(weightKg) / (heightM * heightM) : null;

  let bmr = null;
  if (weightKg && heightCm && ageYears && sex) {
    const s = String(sex).toLowerCase();
    if (s === 'male' || s === 'hombre') bmr = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * Number(ageYears) + 5;
    if (s === 'female' || s === 'mujer') bmr = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * Number(ageYears) - 161;
  }

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  const mult = activityLevel ? multipliers[String(activityLevel)] || null : null;
  const tdee = bmr && mult ? bmr * mult : null;

  return {
    bmi: bmi != null ? Number(bmi.toFixed(2)) : null,
    bmr_kcal: bmr != null ? Number(bmr.toFixed(0)) : null,
    tdee_kcal: tdee != null ? Number(tdee.toFixed(0)) : null
  };
}

function getCheckinMetaParts(now = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const slot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return {
    slotKey: slot,
    noteDate: now.toISOString().slice(0, 10),
    hour
  };
}

function addDays(dateString, days) {
  const base = new Date(`${dateString}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function summarizeEntryTitle(title = '') {
  const clean = compactText(title);
  if (!clean) return null;
  return clean.length > 72 ? `${clean.slice(0, 69).trim()}...` : clean;
}

function inferTrainingContext({ focus = '', notes = '', exercises = [] } = {}) {
  const raw = compactText([focus, notes, ...exercises.map((exercise) => exercise?.exercise_name || '')].join(' ')).toLowerCase();

  let bucket = null;
  if (/full\s*body|fullbody|cuerpo completo/.test(raw)) bucket = 'fullbody';
  else if (/upper|parte superior|torso/.test(raw)) bucket = 'upper';
  else if (/lower|pierna|legs|espalda/.test(raw)) bucket = 'lower';

  const labelMap = {
    fullbody: 'full body',
    upper: 'upper',
    lower: 'lower'
  };

  const isReadaptation = /vuelta al gym|readapt|semana1|técnica|tecnica|sensaciones|progresión suave|progresion suave/.test(raw);

  return {
    bucket,
    label: bucket ? labelMap[bucket] : null,
    isReadaptation
  };
}

function derivePreviousDayCue({ previousDayTotals = null, recentNotes = [] } = {}) {
  if (previousDayTotals?.entriesCount > 0) {
    const prevProtein = Number(previousDayTotals.protein || 0);
    const prevCarbs = Number(previousDayTotals.carbs || 0);
    const prevCalories = Number(previousDayTotals.calories || 0);

    if (prevProtein < 95) return 'Ayer la proteína se quedó algo corta.';
    if (prevCarbs > 50) return 'Ayer los carbs se fueron algo arriba.';
    if (prevCalories > 0 && prevCalories < 1500) return 'Ayer la ingesta quedó algo justa para apoyar bien el entreno.';
  }

  const previousNote = recentNotes.find((note) => note.note_date && note.note_date !== recentNotes[0]?.note_date) || recentNotes[0] || null;
  if (!previousNote) return null;

  const joined = compactText(`${previousNote.title} ${previousNote.body}`).toLowerCase();
  if (!joined) return null;
  if (joined.includes('proteína') || joined.includes('proteina')) return 'Ayer ya salió la señal de reforzar proteína.';
  if (joined.includes('carbohidratos') || joined.includes('carbs')) return 'Ayer ya quedó apuntado que los carbs se fueron algo arriba.';
  if (joined.includes('recuperación') || joined.includes('recuperacion')) return 'La última nota ya iba de priorizar recuperación.';
  return null;
}

function deriveRecentReviewCue(review = null) {
  if (!review?.summary) return null;
  const summary = compactText(review.summary).toLowerCase();
  if (/pronto|progresión suave|progresion suave|no subir carga|mantendr/i.test(summary)) {
    return 'Sigues en fase de ir sumando con calma, no de correr a por peso.';
  }
  if (/recuperación|recuperacion|fatiga|volumen/.test(summary)) {
    return 'La señal reciente pide gestionar fatiga y recuperación antes que apretar más.';
  }
  return null;
}

function deriveLatestSessionCue(session = null) {
  if (!session) return null;
  const energy = session.perceived_energy != null ? Number(session.perceived_energy) : null;
  const effort = session.perceived_effort != null ? Number(session.perceived_effort) : null;
  const notes = compactText(session.notes);

  if (energy != null && effort != null) {
    if (energy >= 8 && effort <= 6) return 'Vienes de una sesión bastante controlada.';
    if (effort >= 8) return 'El último entreno apretó bastante, así que hoy compensa ir fino.';
  }

  if (/facilidad|fácil|facil|bien/.test(notes.toLowerCase())) return 'El último entreno dejó buenas sensaciones.';
  return null;
}

function deriveTodayNutritionCue({ todayEntries = [], todayProtein = 0, todayCalories = 0, todayCarbs = 0, hour = 0, trainingBucket = null }) {
  const latestTodayEntry = todayEntries.length ? todayEntries[todayEntries.length - 1] : null;
  const latestTitle = summarizeEntryTitle(latestTodayEntry?.title);

  if (!todayEntries.length) {
    if (trainingBucket) return `Todavía no hay comida registrada y hoy toca ${trainingBucket === 'fullbody' ? 'full body' : trainingBucket}.`;
    return 'Todavía no hay comida registrada hoy.';
  }

  if (todayEntries.length === 1 && todayProtein < 20) {
    if (latestTitle) return `De momento solo entra ${latestTitle.toLowerCase()} y la proteína sigue muy corta.`;
    return 'De momento el día sigue muy ligero y la proteína va corta.';
  }

  if (todayProtein < (hour >= 15 ? 80 : 55)) {
    return `Hoy sigues corto de proteína (${todayProtein.toFixed(0)} g).`;
  }

  if (todayCarbs > 50) {
    return `Hoy ya vas en ${todayCarbs.toFixed(0)} g de carbs.`;
  }

  if (todayCalories > 0 && todayCalories < 900 && hour >= 15) {
    return `A esta hora la energía sigue algo justa (${todayCalories.toFixed(0)} kcal).`;
  }

  return null;
}

function buildDayNote({
  noteDate,
  hour,
  todayTotals,
  todayEntries,
  previousDayTotals,
  recentNotes,
  recentReviews,
  latestSession,
  plannedDay,
  plannedExercises,
  weightKg,
  goalWeightKg
}) {
  const todayCalories = Number(todayTotals?.calories || 0);
  const todayProtein = Number(todayTotals?.protein || 0);
  const todayCarbs = Number(todayTotals?.carbs || 0);
  const todayFat = Number(todayTotals?.fat || 0);
  const todayEntriesCount = Array.isArray(todayEntries) ? todayEntries.length : 0;

  const trainingContext = inferTrainingContext({
    focus: plannedDay?.focus,
    notes: plannedDay?.notes,
    exercises: plannedExercises
  });

  const lastReview = recentReviews[0] || null;
  const previousDayCue = derivePreviousDayCue({ previousDayTotals, recentNotes });
  const reviewCue = deriveRecentReviewCue(lastReview);
  const latestSessionCue = deriveLatestSessionCue(latestSession);
  const todayNutritionCue = deriveTodayNutritionCue({
    todayEntries,
    todayProtein,
    todayCalories,
    todayCarbs,
    hour,
    trainingBucket: trainingContext.bucket
  });

  const latestSessionDateKey = latestSession?.training_date
    ? new Date(latestSession.training_date).toISOString().slice(0, 10)
    : null;
  const sessionIsToday = latestSessionDateKey === noteDate;
  const trainedToday = Boolean(sessionIsToday && latestSession?.completed_at);
  const breakfastDone = todayEntries.some((entry) => /desayuno/i.test(String(entry.meal_type || '')));
  const lunchDone = todayEntries.some((entry) => /comida|almuerzo/i.test(String(entry.meal_type || '')));
  const dinnerDone = todayEntries.some((entry) => /cena/i.test(String(entry.meal_type || '')));

  let title = 'Día todavía muy abierto';
  let body = 'Aún falta contexto real de hoy. En cuanto entren o entren más comidas, te dejo una lectura mejor.';
  let tone = 'neutral';

  const dayLabel = trainingContext.label ? `Hoy toca ${trainingContext.label}.` : plannedDay ? 'Hoy hay entreno planificado.' : 'Hoy no hay entreno marcado.';

  if (hour < 11) {
    title = plannedDay ? 'Arranque del día' : 'Lectura temprana';
    if (!breakfastDone && todayEntriesCount === 0) {
      body = compactText(`${dayLabel} Aún no hay desayuno registrado. La clave ahora es no llegar al entreno vacío y empezar a meter proteína pronto.`);
      tone = plannedDay ? 'watch' : 'neutral';
    } else {
      body = compactText(`${dayLabel} De momento vas en ${todayCalories.toFixed(0)} kcal y ${todayProtein.toFixed(0)} g de proteína. La mañana pinta abierta todavía; me fijaría sobre todo en construir bien el resto del día.`);
    }
  } else if (hour < 14) {
    title = plannedDay ? 'Mitad del día' : 'Lectura del mediodía';
    if (trainedToday) {
      body = compactText(`El entreno ya está hecho. Ahora la lectura útil no es repetir el plan, sino cerrar recuperación: proteína decente, comida real y no quedarte demasiado corto de calorías.`);
      tone = 'good';
    } else if (!lunchDone) {
      body = compactText(`${dayLabel} A estas horas lo importante es llegar con mejor base: te falta una comida seria y más proteína antes de pensar en el entreno.`);
      tone = 'watch';
    } else {
      body = compactText(`${dayLabel} Ya hay algo de comida real metida. Vas en ${todayProtein.toFixed(0)} g de proteína y ${todayCarbs.toFixed(0)} g de carbs; el siguiente paso es usar bien eso según entrenes o no luego.`);
    }
  } else if (hour < 17) {
    title = plannedDay ? 'Pre-entreno' : 'Tarde en marcha';
    if (trainedToday) {
      body = compactText(`El entreno ya dejó señal hoy. Ahora mismo me fijaría más en recuperación y en no dejar el día demasiado corto de ingesta que en seguir pensando en el pre-entreno.`);
      tone = Number(latestSession?.perceived_effort || 0) >= 8 ? 'watch' : 'good';
    } else if (todayNutritionCue) {
      body = compactText(`${dayLabel} ${todayNutritionCue}${previousDayCue ? ` ${previousDayCue}` : ''}`);
      tone = /corta|corto|ligero|justa|carbs/.test(todayNutritionCue.toLowerCase()) ? 'watch' : 'neutral';
    } else {
      body = compactText(`${dayLabel} La tarde ahora mismo pide llegar con energía usable y sin ir improvisando. Lo más importante es no llegar muy vacío al entreno.`);
    }
  } else if (hour < 20) {
    title = trainedToday ? 'Post-entreno' : plannedDay ? 'Ventana de decisión' : 'Lectura de la tarde';
    if (trainedToday) {
      const energy = Number(latestSession?.perceived_energy || 0);
      const effort = Number(latestSession?.perceived_effort || 0);
      body = compactText(`Entreno hecho. Salió con energía ${energy || '—'} y esfuerzo ${effort || '—'}. La lectura útil ahora es simple: recuperar bien, subir proteína si hace falta y no cerrar el día demasiado por debajo si quieres seguir rindiendo.`);
      tone = effort >= 8 ? 'watch' : 'good';
    } else {
      body = compactText(`${dayLabel} A esta hora la nota debería ayudarte a decidir: si entrenas, vete a técnica y margen; si no entrenas, ordena la cena y deja el día mejor cerrado.`);
    }
  } else {
    title = trainedToday ? 'Cierre del día' : 'Resumen de la jornada';
    if (trainedToday) {
      body = compactText(`Hoy acabas en ${todayCalories.toFixed(0)} kcal, ${todayProtein.toFixed(0)} g de proteína, ${todayCarbs.toFixed(0)} g de carbs y ${todayFat.toFixed(0)} g de grasa. El entreno ya está hecho, así que la lectura real es: ${todayCarbs > 80 ? 'bien para déficit, pero no para keto estricta' : 'día bastante limpio'}${todayCalories < 1700 ? ', y quizá algo corto de ingesta para un día con gym' : ''}.`);
      tone = todayCalories < 1700 || todayCarbs > 80 ? 'watch' : 'good';
    } else if (todayEntriesCount > 0) {
      body = compactText(`Cierras el día en ${todayCalories.toFixed(0)} kcal, ${todayProtein.toFixed(0)} g de proteína, ${todayCarbs.toFixed(0)} g de carbs y ${todayFat.toFixed(0)} g de grasa. La utilidad aquí está en ver si el día fue coherente con el objetivo, no en repetir consejos genéricos.`);
    }
  }

  if (
    weightKg &&
    goalWeightKg &&
    weightKg > goalWeightKg &&
    todayEntriesCount > 0 &&
    todayProtein >= 100 &&
    todayCarbs <= 60 &&
    latestSession?.perceived_energy != null &&
    Number(latestSession.perceived_energy) >= 8 &&
    Number(latestSession.perceived_effort || 0) <= 6
  ) {
    title = 'Buen día de proceso';
    body = `Buen combo: proteína sólida, carbs contenidos y señal de entreno controlado. Esto ya empuja en buena dirección hacia bajar de ${weightKg.toFixed(0)} a ${goalWeightKg.toFixed(0)} kg.`;
    tone = 'good';
  }

  if (!plannedDay && todayEntriesCount === 0 && !trainedToday) {
    title = 'Día todavía muy abierto';
    body = 'Aún falta contexto real de hoy. En cuanto entren o entren más comidas, te dejo una lectura mejor.';
    tone = 'neutral';
  }

  return {
    title,
    body,
    tone,
    meta: {
      noteDate,
      todayEntriesCount,
      breakfastDone,
      lunchDone,
      dinnerDone,
      trainedToday,
      trainingBucket: trainingContext.bucket,
      previousDayCue,
      reviewCue,
      latestSessionCue,
      todayNutritionCue,
      plannedExercises: plannedExercises.slice(0, 4).map((exercise) => exercise.exercise_name)
    }
  };
}

async function createDayNote(userSlug = 'migue', noteDate = null, slotKey = null, reviewType = 'scheduled_checkin') {
  await ensureNutritionTables();
  await ensureNeoDayNotesTable();
  await ensureBodyMetricsTable();
  await ensureWorkoutExerciseExtras();
  const userId = await getUserId(userSlug);
  const now = new Date();
  const metaParts = getCheckinMetaParts(now);
  const targetDate = noteDate || metaParts.noteDate;
  const targetSlotKey = slotKey || metaParts.slotKey;
  const previousDate = addDays(targetDate, -1);

  const [
    nutritionPayload,
    previousNutritionPayload,
    latestBodyMetrics,
    recentNotesResult,
    recentEntriesResult,
    recentReviewsResult,
    latestSessionResult,
    plannedDayResult
  ] = await Promise.all([
    fetchNutritionDay(userSlug, targetDate),
    fetchNutritionDay(userSlug, previousDate),
    pool.query(
      `SELECT weight_kg, goal_weight_kg FROM body_metrics WHERE user_id = $1 ORDER BY measured_at DESC, created_at DESC LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT note_date, slot_key, title, body, tone
       FROM neo_day_notes
       WHERE user_id = $1 AND note_date < $2::date
       ORDER BY note_date DESC, slot_key DESC, created_at DESC
       LIMIT 4`,
      [userId, targetDate]
    ),
    pool.query(
      `SELECT nd.entry_date, ne.meal_type, ne.title, ne.quantity_text, ne.calories, ne.protein_g, ne.carbs_g, ne.fat_g, ne.fiber_g, ne.source_name, ne.source_note,
              COALESCE(ne.consumed_at, ne.created_at) AS sort_at
       FROM nutrition_entries ne
       JOIN nutrition_days nd ON nd.id = ne.nutrition_day_id
       WHERE nd.user_id = $1 AND nd.entry_date >= ($2::date - interval '3 day')
       ORDER BY sort_at DESC
       LIMIT 8`,
      [userId, targetDate]
    ),
    pool.query(
      `SELECT recommendation_level, summary, adjustments, created_at
       FROM training_reviews
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 3`,
      [userId]
    ),
    pool.query(
      `SELECT ws.id, ws.perceived_energy, ws.perceived_effort, ws.completed_at, ws.notes, wd.training_date, wd.focus, wd.notes AS day_notes
       FROM workout_sessions ws
       JOIN workout_days wd ON wd.id = ws.workout_day_id
       WHERE wd.user_id = $1 AND ws.completed_at IS NOT NULL
       ORDER BY ws.completed_at DESC
       LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT wd.*, ws.id AS session_id
       FROM workout_days wd
       LEFT JOIN workout_sessions ws ON ws.workout_day_id = wd.id
       WHERE wd.user_id = $1 AND wd.training_date = $2::date
       LIMIT 1`,
      [userId, targetDate]
    )
  ]);

  const latestRow = latestSessionResult.rows[0] || null;
  const plannedDayRow = plannedDayResult.rows[0] || null;
  let plannedExercises = [];
  if (plannedDayRow?.session_id) {
    const plannedExercisesResult = await pool.query(
      `SELECT exercise_name, sort_order, target_sets, target_reps, target_notes
       FROM workout_session_exercises
       WHERE session_id = $1
       ORDER BY sort_order ASC`,
      [plannedDayRow.session_id]
    );
    plannedExercises = plannedExercisesResult.rows;
  }

  const metricsRow = latestBodyMetrics.rows[0] || null;
  const note = buildDayNote({
    noteDate: targetDate,
    hour: Number(targetSlotKey.split(':')[0] || metaParts.hour),
    todayTotals: {
      calories: Number(nutritionPayload.totals.calories || 0),
      protein: Number(nutritionPayload.totals.protein_g || 0),
      carbs: Number(nutritionPayload.totals.carbs_g || 0),
      fat: Number(nutritionPayload.totals.fat_g || 0)
    },
    todayEntries: Array.isArray(nutritionPayload.entries) ? nutritionPayload.entries : [],
    previousDayTotals: {
      calories: Number(previousNutritionPayload.totals.calories || 0),
      protein: Number(previousNutritionPayload.totals.protein_g || 0),
      carbs: Number(previousNutritionPayload.totals.carbs_g || 0),
      fat: Number(previousNutritionPayload.totals.fat_g || 0),
      entriesCount: Array.isArray(previousNutritionPayload.entries) ? previousNutritionPayload.entries.length : 0
    },
    recentNotes: recentNotesResult.rows,
    recentReviews: recentReviewsResult.rows,
    latestSession: latestRow,
    plannedDay: plannedDayRow,
    plannedExercises,
    weightKg: metricsRow?.weight_kg != null ? Number(metricsRow.weight_kg) : null,
    goalWeightKg: metricsRow?.goal_weight_kg != null ? Number(metricsRow.goal_weight_kg) : null
  });

  const result = await pool.query(
    `INSERT INTO neo_day_notes (user_id, note_date, slot_key, note_type, title, body, tone, meta)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (user_id, note_date, slot_key)
     DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, tone = EXCLUDED.tone, meta = EXCLUDED.meta
     RETURNING *`,
    [
      userId,
      targetDate,
      targetSlotKey,
      reviewType,
      note.title,
      note.body,
      note.tone,
      JSON.stringify({
        calories: nutritionPayload.totals.calories,
        protein: nutritionPayload.totals.protein_g,
        carbs: nutritionPayload.totals.carbs_g,
        fat: nutritionPayload.totals.fat_g,
        previous_day: {
          calories: previousNutritionPayload.totals.calories,
          protein: previousNutritionPayload.totals.protein_g,
          carbs: previousNutritionPayload.totals.carbs_g,
          fat: previousNutritionPayload.totals.fat_g
        },
        recent_entries: recentEntriesResult.rows,
        recent_notes: recentNotesResult.rows,
        recent_reviews: recentReviewsResult.rows,
        planned_day: plannedDayRow ? { training_date: plannedDayRow.training_date, status: plannedDayRow.status, focus: plannedDayRow.focus, notes: plannedDayRow.notes } : null,
        planned_exercises: plannedExercises,
        latest_session: latestRow,
        generated_context: note.meta
      })
    ]
  );

  return result.rows[0];
}

async function runTrainingReview(userSlug = 'migue', windowDays = 7, reviewType = 'scheduled') {
  await ensureNutritionTables();
  await ensureTrainingReviewTable();
  const userId = await getUserId(userSlug);

  const nutrition = await pool.query(
    `SELECT
       COUNT(DISTINCT nd.entry_date)::int AS tracked_days,
       COALESCE(SUM(ne.calories), 0)::numeric AS calories_total,
       COALESCE(SUM(ne.protein_g), 0)::numeric AS protein_total,
       COALESCE(SUM(ne.carbs_g), 0)::numeric AS carbs_total,
       COALESCE(SUM(ne.fat_g), 0)::numeric AS fat_total
     FROM nutrition_days nd
     LEFT JOIN nutrition_entries ne ON ne.nutrition_day_id = nd.id
     WHERE nd.user_id = $1
       AND nd.entry_date >= current_date - (($2::int - 1) * interval '1 day')`,
    [userId, windowDays]
  );

  const todayNutrition = await pool.query(
    `SELECT
       COALESCE(SUM(ne.calories), 0)::numeric AS calories_total,
       COALESCE(SUM(ne.protein_g), 0)::numeric AS protein_total,
       COALESCE(SUM(ne.carbs_g), 0)::numeric AS carbs_total,
       COALESCE(SUM(ne.fat_g), 0)::numeric AS fat_total,
       COUNT(ne.id)::int AS entries_count
     FROM nutrition_days nd
     LEFT JOIN nutrition_entries ne ON ne.nutrition_day_id = nd.id
     WHERE nd.user_id = $1 AND nd.entry_date = current_date`,
    [userId]
  );

  const latestSession = await pool.query(
    `SELECT ws.perceived_energy, ws.perceived_effort, ws.notes, wd.training_date
     FROM workout_sessions ws
     JOIN workout_days wd ON wd.id = ws.workout_day_id
     WHERE wd.user_id = $1 AND ws.completed_at IS NOT NULL
     ORDER BY ws.completed_at DESC
     LIMIT 1`,
    [userId]
  );

  const sessions = await pool.query(
    `SELECT
       COUNT(*)::int AS sessions_count,
       AVG(ws.perceived_energy)::numeric AS avg_energy,
       AVG(ws.perceived_effort)::numeric AS avg_effort
     FROM workout_sessions ws
     JOIN workout_days wd ON wd.id = ws.workout_day_id
     WHERE wd.user_id = $1
       AND wd.training_date >= current_date - (($2::int - 1) * interval '1 day')
       AND ws.completed_at IS NOT NULL`,
    [userId, windowDays]
  );

  const trackedDays = Number(nutrition.rows[0]?.tracked_days || 0);
  const sessionsCount = Number(sessions.rows[0]?.sessions_count || 0);
  const avgCalories = trackedDays ? Number(nutrition.rows[0]?.calories_total || 0) / trackedDays : 0;
  const avgProtein = trackedDays ? Number(nutrition.rows[0]?.protein_total || 0) / trackedDays : 0;
  const avgCarbs = trackedDays ? Number(nutrition.rows[0]?.carbs_total || 0) / trackedDays : 0;
  const avgFat = trackedDays ? Number(nutrition.rows[0]?.fat_total || 0) / trackedDays : 0;
  const avgEnergy = sessions.rows[0]?.avg_energy != null ? Number(sessions.rows[0].avg_energy) : null;
  const avgEffort = sessions.rows[0]?.avg_effort != null ? Number(sessions.rows[0].avg_effort) : null;
  const todayCalories = Number(todayNutrition.rows[0]?.calories_total || 0);
  const todayProtein = Number(todayNutrition.rows[0]?.protein_total || 0);
  const todayCarbs = Number(todayNutrition.rows[0]?.carbs_total || 0);
  const todayFat = Number(todayNutrition.rows[0]?.fat_total || 0);
  const todayEntries = Number(todayNutrition.rows[0]?.entries_count || 0);
  const latestEnergy = latestSession.rows[0]?.perceived_energy != null ? Number(latestSession.rows[0].perceived_energy) : null;
  const latestEffort = latestSession.rows[0]?.perceived_effort != null ? Number(latestSession.rows[0].perceived_effort) : null;

  let recommendationLevel = 'info';
  let summary = 'Todavía falta señal para tocar el plan; sigue registrando comida y entrenos para que la lectura gane precisión.';
  let adjustments = {
    training: { load: 'keep', volume: 'keep', recovery: 'normal' },
    nutrition: { protein: 'watch', intake: 'watch', carbs: 'watch' },
    notes: ['Seguir registrando comidas y cerrar sesiones con energía/esfuerzo.']
  };

  if (todayEntries > 0) {
    summary = `Hoy llevas ${todayCalories.toFixed(0)} kcal, ${todayProtein.toFixed(0)} g de proteína, ${todayCarbs.toFixed(0)} g de carbohidratos y ${todayFat.toFixed(0)} g de grasa.`;
    adjustments = {
      training: { load: 'keep', volume: 'keep', recovery: 'watch' },
      nutrition: {
        protein: todayProtein >= 110 ? 'ok' : 'raise',
        intake: todayCalories >= 1700 ? 'ok' : 'watch',
        carbs: todayCarbs <= 40 ? 'keto_ok' : 'keto_high'
      },
      notes: ['La recomendación del dashboard debe leerse contra lo que ya has comido hoy y si has entrenado o no.']
    };
  }

  if (todayEntries > 0 && latestEnergy !== null && latestEffort !== null) {
    if (latestEnergy >= 8 && latestEffort <= 6 && todayProtein >= 100) {
      recommendationLevel = 'good';
      summary = `Buena señal hoy: nutrición ya bastante armada (${todayProtein.toFixed(0)} g proteína / ${todayCarbs.toFixed(0)} g carbs) y el último entreno salió controlado. Mantendría la progresión suave y observaría el próximo entreno.`;
      adjustments = {
        training: { load: 'small_progress', volume: 'keep', recovery: 'normal' },
        nutrition: { protein: 'ok', intake: todayCalories >= 1700 ? 'ok' : 'watch', carbs: todayCarbs <= 40 ? 'keto_ok' : 'keto_high' },
        notes: ['Si el próximo entreno vuelve a sentirse fácil en ciertos ejercicios, ya se puede subir ligeramente.']
      };
    } else if (todayProtein < 95 || todayCalories < 1500) {
      recommendationLevel = 'watch';
      summary = `La señal de hoy pide calma: proteína o ingesta total todavía algo cortas para empujar progresión. Mantendría carga y vigilaría recuperación antes de tocar pesos.`;
      adjustments = {
        training: { load: 'hold', volume: 'keep', recovery: 'prioritize' },
        nutrition: { protein: 'raise', intake: 'raise', carbs: todayCarbs <= 40 ? 'keto_ok' : 'keto_high' },
        notes: ['Priorizar llegar mejor a proteína y no forzar subida de carga todavía.']
      };
    }
  }

  if (trackedDays >= 3 && sessionsCount >= 2 && avgEffort !== null && avgEnergy !== null) {
    if (avgCalories < 1400 || avgProtein < 90 || (avgEffort >= 8 && avgEnergy <= 6)) {
      recommendationLevel = 'watch';
      summary = 'La señal reciente sugiere no subir carga/volumen todavía. Priorizar recuperación y asegurar mejor soporte nutricional antes de progresar.';
      adjustments = {
        training: { load: 'hold', volume: 'hold_or_reduce', recovery: 'prioritize' },
        nutrition: { protein: avgProtein < 90 ? 'raise' : 'ok', intake: avgCalories < 1400 ? 'raise' : 'ok', carbs: avgCarbs <= 40 ? 'keto_ok' : 'keto_high' },
        notes: [
          'Si el próximo entreno vuelve a salir con energía baja y esfuerzo alto, no progresar cargas.',
          'Vigilar especialmente proteína diaria e ingesta en días de entreno.'
        ]
      };
    } else if (avgCalories >= 1800 && avgProtein >= 110 && avgEnergy >= 7 && avgEffort <= 7.5) {
      recommendationLevel = 'good';
      summary = 'La señal reciente es buena. Si el próximo entreno confirma sensaciones, se puede progresar de forma ligera en carga o repeticiones.';
      adjustments = {
        training: { load: 'small_progress', volume: 'keep', recovery: 'normal' },
        nutrition: { protein: 'ok', intake: 'ok', carbs: avgCarbs <= 40 ? 'keto_ok' : 'keto_high' },
        notes: ['Si la próxima sesión sale sólida, subir ligeramente reps o carga en básicos.']
      };
    }
  }

  const result = await pool.query(
    `INSERT INTO training_reviews (
       user_id, review_type, window_days, tracked_days, sessions_count, avg_calories, avg_protein_g, avg_carbs_g, avg_fat_g, avg_energy, avg_effort, recommendation_level, summary, adjustments
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     RETURNING *`,
    [userId, reviewType, windowDays, trackedDays, sessionsCount, avgCalories, avgProtein, avgCarbs, avgFat, avgEnergy, avgEffort, recommendationLevel, summary, JSON.stringify(adjustments)]
  );

  return result.rows[0];
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
    await ensureWorkoutExerciseExtras();
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
      exercises = await fetchSessionExercisesWithReferences(session.id, userId, trainingDate);
    }

    res.json({ ok: true, day, session, exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/session/refresh-ghosts', async (req, res) => {
  const {
    user = 'migue',
    trainingDate,
    updateTargets = true
  } = req.body || {};

  if (!trainingDate) {
    return res.status(400).json({ ok: false, message: 'trainingDate is required' });
  }

  try {
    await ensureWorkoutExerciseExtras();
    const userId = await getUserId(user);
    const dayResult = await pool.query(
      `SELECT * FROM workout_days WHERE user_id = $1 AND training_date = $2::date LIMIT 1`,
      [userId, trainingDate]
    );

    if (!dayResult.rowCount) return res.json({ ok: true, updated: 0, exercises: [] });

    const day = dayResult.rows[0];
    const sessionResult = await pool.query('SELECT * FROM workout_sessions WHERE workout_day_id = $1 LIMIT 1', [day.id]);
    if (!sessionResult.rowCount) return res.json({ ok: true, updated: 0, exercises: [] });

    const session = sessionResult.rows[0];
    const exerciseRows = await pool.query(
      `SELECT *
       FROM workout_session_exercises
       WHERE session_id = $1
       ORDER BY sort_order ASC`,
      [session.id]
    );

    let updated = 0;
    for (const exercise of exerciseRows.rows) {
      const previous = exercise.exercise_name
        ? await fetchPreviousExerciseReference(userId, trainingDate, exercise.exercise_name)
        : null;

      if (!previous || !updateTargets || exercise.is_logged) continue;

      const nextTargetWeight = previous.weight_kg != null ? Number(previous.weight_kg) : null;
      const currentTargetWeight = exercise.target_weight_kg != null ? Number(exercise.target_weight_kg) : null;

      if (nextTargetWeight != null && currentTargetWeight !== nextTargetWeight) {
        await pool.query(
          `UPDATE workout_session_exercises
           SET target_weight_kg = $2,
               updated_at = now()
           WHERE id = $1`,
          [exercise.id, nextTargetWeight]
        );
        updated += 1;
      }
    }

    const exercises = await fetchSessionExercisesWithReferences(session.id, userId, trainingDate);
    res.json({ ok: true, updated, exercises });
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
    exerciseType = 'strength',
    isCustom = false,
    sortOrder = 0,
    targetSets = null,
    targetReps = null,
    targetWeightKg = null,
    targetNotes = null,
    actualSets = null,
    actualNotes = null,
    actualDurationMinutes = null,
    actualDistanceKm = null,
    actualCaloriesBurned = null,
    isLogged = true,
    difficulty = null,
    reps = null,
    weightKg = null,
    effort = null
  } = req.body || {};

  if (!trainingDate || !exerciseName) {
    return res.status(400).json({ ok: false, message: 'trainingDate and exerciseName are required' });
  }

  try {
    await ensureWorkoutExerciseExtras();
    const userId = await getUserId(user);
    const day = await getOrCreateDay(userId, trainingDate, 'planned');
    const session = await getOrCreateSession(day.id);

    const sessionExercise = (
      await pool.query(
        `INSERT INTO workout_session_exercises (
           session_id, exercise_name, exercise_type, is_custom, sort_order, target_sets, target_reps, target_weight_kg, target_notes, actual_sets, actual_notes, actual_duration_minutes, actual_distance_km, actual_calories_burned, is_logged, difficulty
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (session_id, sort_order)
         DO UPDATE SET
           exercise_name = EXCLUDED.exercise_name,
           exercise_type = EXCLUDED.exercise_type,
           is_custom = EXCLUDED.is_custom,
           target_sets = EXCLUDED.target_sets,
           target_reps = EXCLUDED.target_reps,
           target_weight_kg = EXCLUDED.target_weight_kg,
           target_notes = EXCLUDED.target_notes,
           actual_sets = EXCLUDED.actual_sets,
           actual_notes = EXCLUDED.actual_notes,
           actual_duration_minutes = EXCLUDED.actual_duration_minutes,
           actual_distance_km = EXCLUDED.actual_distance_km,
           actual_calories_burned = EXCLUDED.actual_calories_burned,
           is_logged = EXCLUDED.is_logged,
           difficulty = EXCLUDED.difficulty,
           updated_at = now()
         RETURNING *`,
        [session.id, exerciseName, exerciseType, isCustom, sortOrder, targetSets, targetReps, targetWeightKg, targetNotes, actualSets, actualNotes, actualDurationMinutes, actualDistanceKm, actualCaloriesBurned, isLogged, difficulty]
      )
    ).rows[0];

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

app.post('/api/session/closeout', async (req, res) => {
  const {
    user = 'migue',
    trainingDate,
    durationMinutes = null,
    perceivedEnergy = null,
    perceivedEffort = null,
    notes = null
  } = req.body || {};

  if (!trainingDate) return res.status(400).json({ ok: false, message: 'trainingDate is required' });

  try {
    const userId = await getUserId(user);
    const day = await getOrCreateDay(userId, trainingDate, 'planned');
    const session = await getOrCreateSession(day.id);

    const sessionResult = await pool.query(
      `UPDATE workout_sessions
       SET duration_minutes = $2,
           perceived_energy = $3,
           perceived_effort = $4,
           notes = $5,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [session.id, durationMinutes, perceivedEnergy, perceivedEffort, notes]
    );

    res.json({ ok: true, session: sessionResult.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ ok: false, message });
  }
});

app.delete('/api/session/exercise', async (req, res) => {
  const { user = 'migue', trainingDate, sortOrder = null } = req.body || {};
  if (!trainingDate || sortOrder == null) {
    return res.status(400).json({ ok: false, message: 'trainingDate and sortOrder are required' });
  }

  try {
    await ensureWorkoutExerciseExtras();
    const userId = await getUserId(user);
    const dayResult = await pool.query(`SELECT id FROM workout_days WHERE user_id = $1 AND training_date = $2::date LIMIT 1`, [userId, trainingDate]);
    if (!dayResult.rowCount) return res.json({ ok: true, deleted: false });

    const sessionResult = await pool.query(`SELECT id FROM workout_sessions WHERE workout_day_id = $1 LIMIT 1`, [dayResult.rows[0].id]);
    if (!sessionResult.rowCount) return res.json({ ok: true, deleted: false });

    const deleted = await pool.query(
      `DELETE FROM workout_session_exercises
       WHERE session_id = $1 AND sort_order = $2
         AND (
           is_custom = true
           OR (
             exercise_type = 'cardio'
             AND target_sets IS NULL
             AND target_reps IS NULL
             AND target_weight_kg IS NULL
           )
         )
       RETURNING id`,
      [sessionResult.rows[0].id, Number(sortOrder)]
    );

    res.json({ ok: true, deleted: deleted.rowCount > 0 });
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
    const review = await runTrainingReview(user, 7, 'session_complete');
    const wakeEvent = await createNeoWakeEvent({
      userId,
      sessionId: session.id,
      trainingDate,
      eventType: 'session_complete',
      payload: {
        source: 'complete_session_button',
        user,
        trainingDate,
        completedAt
      }
    });

    res.json({
      ok: true,
      day: { ...day, status: 'done' },
      session: sessionResult.rows[0],
      review,
      analysis: { status: 'pending_neo', message: 'Sesión cerrada y pendiente de análisis por Neo.' },
      wakeEvent: { id: wakeEvent.id, status: 'pending_ack' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/session/pending-analysis', async (req, res) => {
  const user = String(req.query.user || 'migue');
  try {
    const result = await pool.query(
      `SELECT ws.id
       FROM workout_sessions ws
       JOIN workout_days wd ON wd.id = ws.workout_day_id
       JOIN app_users u ON u.id = wd.user_id
       WHERE u.slug = $1
         AND ws.coach_summary = 'PENDIENTE_NEO'
         AND ws.completed_at IS NOT NULL
       ORDER BY ws.completed_at DESC NULLS LAST, ws.updated_at DESC
       LIMIT 1`,
      [user]
    );
    if (!result.rowCount) return res.json({ ok: true, pending: false });
    const bundle = await fetchSessionBundleBySessionId(result.rows[0].id);
    res.json({ ok: true, pending: true, ...bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ ok: false, message });
  }
});

app.get('/api/neo-wake/pending', async (req, res) => {
  const user = String(req.query.user || 'migue');
  try {
    await ensureNeoWakeTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `SELECT id, event_type, session_id, training_date, payload, created_at
       FROM neo_wake_events
       WHERE user_id = $1
         AND acked_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    );
    if (!result.rowCount) return res.json({ ok: true, pending: false });
    res.json({ ok: true, pending: true, event: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/neo-wake/ack', async (req, res) => {
  const { eventId } = req.body || {};
  if (!eventId) return res.status(400).json({ ok: false, message: 'eventId is required' });
  try {
    await ensureNeoWakeTable();
    const result = await pool.query(
      `UPDATE neo_wake_events
       SET acked_at = now()
       WHERE id = $1
       RETURNING *`,
      [eventId]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, message: 'event not found' });
    res.json({ ok: true, event: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ ok: false, message });
  }
});

app.post('/api/session/mark-analyzed', async (req, res) => {
  const { sessionId, summary = null } = req.body || {};
  if (!sessionId) return res.status(400).json({ ok: false, message: 'sessionId is required' });
  try {
    const result = await pool.query(
      `UPDATE workout_sessions
       SET coach_summary = $2,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [sessionId, summary || `ANALYZED_BY_NEO:${new Date().toISOString()}`]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, message: 'session not found' });
    res.json({ ok: true, session: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ ok: false, message });
  }
});

app.get('/api/nutrition', async (req, res) => {
  const user = String(req.query.user || 'migue');
  const entryDate = String(req.query.date || '').trim();
  if (!entryDate) return res.status(400).json({ ok: false, message: 'date is required' });

  try {
    const payload = await fetchNutritionDay(user, entryDate);
    res.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/training-review/latest', async (req, res) => {
  const user = String(req.query.user || 'migue');
  try {
    await ensureTrainingReviewTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `SELECT * FROM training_reviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    res.json({ ok: true, review: result.rows[0] || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/weekly-programming-review/latest', async (req, res) => {
  const user = String(req.query.user || 'migue');
  try {
    await ensureWeeklyProgrammingReviewsTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `SELECT *
       FROM weekly_programming_reviews
       WHERE user_id = $1
       ORDER BY week_start_date DESC, created_at DESC
       LIMIT 1`,
      [userId]
    );
    res.json({ ok: true, review: result.rows[0] || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/weekly-programming-review', async (req, res) => {
  const user = String(req.query.user || 'migue');
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 8));
  try {
    await ensureWeeklyProgrammingReviewsTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `SELECT *
       FROM weekly_programming_reviews
       WHERE user_id = $1
       ORDER BY week_start_date DESC, created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    res.json({ ok: true, reviews: result.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/neo-day-notes', async (req, res) => {
  const user = String(req.query.user || 'migue');
  const noteDate = String(req.query.date || '').trim();
  if (!noteDate) return res.status(400).json({ ok: false, message: 'date is required' });

  try {
    await ensureNeoDayNotesTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `SELECT * FROM neo_day_notes WHERE user_id = $1 AND note_date = $2::date ORDER BY slot_key DESC, created_at DESC`,
      [userId, noteDate]
    );
    res.json({ ok: true, notes: result.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/neo-day-notes/run', async (req, res) => {
  const { user = 'migue', noteDate = null, slotKey = null, noteType = 'scheduled_checkin' } = req.body || {};
  try {
    const note = await createDayNote(user, noteDate, slotKey, noteType);
    res.json({ ok: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/body-metrics/latest', async (req, res) => {
  const user = String(req.query.user || 'migue');
  try {
    await ensureBodyMetricsTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `SELECT * FROM body_metrics WHERE user_id = $1 ORDER BY measured_at DESC, created_at DESC LIMIT 1`,
      [userId]
    );
    res.json({ ok: true, metrics: result.rows[0] || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/weekly-programming-review', async (req, res) => {
  const {
    user = 'migue',
    weekStartDate,
    weekEndDate,
    reviewScope = 'weekly',
    blockPhase = null,
    sourceWindowDays = 21,
    summary,
    changes = {},
    recommendations = {},
    sentMessage = null,
    sentToTelegramAt = null
  } = req.body || {};

  if (!weekStartDate || !weekEndDate || !summary) {
    return res.status(400).json({ ok: false, message: 'weekStartDate, weekEndDate and summary are required' });
  }

  try {
    await ensureWeeklyProgrammingReviewsTable();
    const userId = await getUserId(user);
    const result = await pool.query(
      `INSERT INTO weekly_programming_reviews (
         user_id, week_start_date, week_end_date, review_scope, block_phase, source_window_days, summary, changes_json, recommendations_json, sent_message, sent_to_telegram_at
       ) VALUES ($1, $2::date, $3::date, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
       RETURNING *`,
      [
        userId,
        weekStartDate,
        weekEndDate,
        reviewScope,
        blockPhase,
        Number(sourceWindowDays) || 21,
        summary,
        JSON.stringify(changes || {}),
        JSON.stringify(recommendations || {}),
        sentMessage,
        sentToTelegramAt
      ]
    );
    res.json({ ok: true, review: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/body-metrics', async (req, res) => {
  const {
    user = 'migue',
    measuredAt = new Date().toISOString(),
    weightKg = null,
    goalWeightKg = null,
    heightCm = null,
    ageYears = null,
    sex = null,
    activityLevel = null,
    bodyFatPct = null,
    note = null,
    source = 'chat'
  } = req.body || {};

  try {
    await ensureBodyMetricsTable();
    const userId = await getUserId(user);
    const stats = calculateBodyStats({ weightKg, goalWeightKg, heightCm, ageYears, sex, activityLevel });
    const result = await pool.query(
      `INSERT INTO body_metrics (
         user_id, measured_at, weight_kg, goal_weight_kg, height_cm, age_years, sex, activity_level, body_fat_pct, bmi, bmr_kcal, tdee_kcal, note, source
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [userId, measuredAt, weightKg, goalWeightKg, heightCm, ageYears, sex, activityLevel, bodyFatPct, stats.bmi, stats.bmr_kcal, stats.tdee_kcal, note, source]
    );
    res.json({ ok: true, metrics: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/stats/weekly', async (req, res) => {
  const user = String(req.query.user || 'migue');
  const mode = String(req.query.mode || 'last7');

  try {
    await ensureBodyMetricsTable();
    const userId = await getUserId(user);

    const getZurichToday = () => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zurich',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const year = Number(parts.find((part) => part.type === 'year')?.value);
      const month = Number(parts.find((part) => part.type === 'month')?.value);
      const day = Number(parts.find((part) => part.type === 'day')?.value);
      return new Date(Date.UTC(year, month - 1, day));
    };

    const addDays = (date, amount) => {
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + amount);
      return next;
    };

    const formatDateKey = (date) => date.toISOString().slice(0, 10);
    const today = getZurichToday();
    const startOfWeek = addDays(today, -((today.getUTCDay() + 6) % 7));

    let startDate = addDays(today, -6);
    let endDate = today;
    let label = 'Últimos 7 días';

    if (mode === 'this_week') {
      startDate = startOfWeek;
      endDate = addDays(startOfWeek, 6);
      label = 'Esta semana';
    } else if (mode === 'previous_week') {
      endDate = addDays(startOfWeek, -1);
      startDate = addDays(endDate, -6);
      label = 'Semana pasada';
    } else if (mode === 'last30') {
      startDate = addDays(today, -29);
      endDate = today;
      label = '30 días';
    }

    const startKey = formatDateKey(startDate);
    const endKey = formatDateKey(endDate);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

    const nutritionResult = await pool.query(
      `SELECT nd.entry_date,
              COALESCE(SUM(ne.calories), 0)::numeric AS calories,
              COALESCE(SUM(ne.protein_g), 0)::numeric AS protein,
              COALESCE(SUM(ne.carbs_g), 0)::numeric AS carbs,
              COALESCE(SUM(ne.fat_g), 0)::numeric AS fat
       FROM nutrition_days nd
       LEFT JOIN nutrition_entries ne ON ne.nutrition_day_id = nd.id
       WHERE nd.user_id = $1
         AND nd.entry_date BETWEEN $2::date AND $3::date
       GROUP BY nd.entry_date
       ORDER BY nd.entry_date ASC`,
      [userId, startKey, endKey]
    );

    const trainingResult = await pool.query(
      `SELECT wd.training_date,
              wd.status,
              ws.completed_at,
              ws.perceived_energy,
              ws.perceived_effort
       FROM workout_days wd
       LEFT JOIN workout_sessions ws ON ws.workout_day_id = wd.id
       WHERE wd.user_id = $1
         AND wd.training_date BETWEEN $2::date AND $3::date
       ORDER BY wd.training_date ASC`,
      [userId, startKey, endKey]
    );

    const weightResult = await pool.query(
      `SELECT DISTINCT ON (date(measured_at))
          date(measured_at) AS measure_date,
          weight_kg,
          goal_weight_kg,
          body_fat_pct
       FROM body_metrics
       WHERE user_id = $1
         AND date(measured_at) BETWEEN $2::date AND $3::date
       ORDER BY date(measured_at), measured_at DESC, created_at DESC`,
      [userId, startKey, endKey]
    );

    const toDateKey = (value) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    };

    const dayKeys = Array.from({ length: days }, (_, index) => formatDateKey(addDays(startDate, index)));

    const nutritionMap = new Map(nutritionResult.rows.map((row) => [toDateKey(row.entry_date), row]));
    const trainingMap = new Map(trainingResult.rows.map((row) => [toDateKey(row.training_date), row]));
    const weightMap = new Map(weightResult.rows.map((row) => [toDateKey(row.measure_date), row]));

    const daily = dayKeys.map((dateKey) => {
      const nutrition = nutritionMap.get(dateKey);
      const training = trainingMap.get(dateKey);
      const weight = weightMap.get(dateKey);
      return {
        date: dateKey,
        calories: Number(nutrition?.calories || 0),
        protein: Number(nutrition?.protein || 0),
        carbs: Number(nutrition?.carbs || 0),
        fat: Number(nutrition?.fat || 0),
        planned: Boolean(training),
        completed: Boolean(training?.completed_at || training?.status === 'done'),
        energy: training?.perceived_energy != null ? Number(training.perceived_energy) : null,
        effort: training?.perceived_effort != null ? Number(training.perceived_effort) : null,
        weightKg: weight?.weight_kg != null ? Number(weight.weight_kg) : null,
        goalWeightKg: weight?.goal_weight_kg != null ? Number(weight.goal_weight_kg) : null,
        bodyFatPct: weight?.body_fat_pct != null ? Number(weight.body_fat_pct) : null
      };
    });

    const plannedDays = daily.filter((day) => day.planned).length;
    const completedDays = daily.filter((day) => day.completed).length;
    const trackedNutritionDays = daily.filter((day) => day.calories > 0).length;
    const totalCalories = daily.reduce((sum, day) => sum + day.calories, 0);
    const totalProtein = daily.reduce((sum, day) => sum + day.protein, 0);
    const totalCarbs = daily.reduce((sum, day) => sum + day.carbs, 0);
    const totalFat = daily.reduce((sum, day) => sum + day.fat, 0);
    const energyValues = daily.map((day) => day.energy).filter((value) => value != null);
    const effortValues = daily.map((day) => day.effort).filter((value) => value != null);
    const weightValues = daily.filter((day) => day.weightKg != null);
    const firstWeight = weightValues[0]?.weightKg ?? null;
    const latestWeight = weightValues[weightValues.length - 1]?.weightKg ?? null;

    const summary = {
      adherencePct: plannedDays ? Math.round((completedDays / plannedDays) * 100) : 0,
      plannedDays,
      completedDays,
      trackedNutritionDays,
      avgCalories: trackedNutritionDays ? totalCalories / trackedNutritionDays : 0,
      avgProtein: trackedNutritionDays ? totalProtein / trackedNutritionDays : 0,
      avgCarbs: trackedNutritionDays ? totalCarbs / trackedNutritionDays : 0,
      avgFat: trackedNutritionDays ? totalFat / trackedNutritionDays : 0,
      avgEnergy: energyValues.length ? energyValues.reduce((sum, value) => sum + Number(value), 0) / energyValues.length : null,
      avgEffort: effortValues.length ? effortValues.reduce((sum, value) => sum + Number(value), 0) / effortValues.length : null,
      currentWeightKg: latestWeight,
      weightDeltaKg: latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null,
      goalWeightKg: weightValues[weightValues.length - 1]?.goalWeightKg ?? null,
      macroTotals: {
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat
      }
    };

    res.json({ ok: true, mode, label, startDate: startKey, endDate: endKey, days, summary, daily });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/training-review/run', async (req, res) => {
  const { user = 'migue', windowDays = 7, reviewType = 'manual' } = req.body || {};
  try {
    const review = await runTrainingReview(user, Number(windowDays) || 7, reviewType);
    res.json({ ok: true, review });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.post('/api/nutrition/entry', async (req, res) => {
  const {
    user = 'migue',
    entryDate,
    mealType = null,
    title,
    quantityText = null,
    calories = 0,
    proteinG = 0,
    carbsG = 0,
    fatG = 0,
    fiberG = null,
    items = [],
    sourceName = null,
    sourceUrl = null,
    sourceNote = null,
    consumedAt = null
  } = req.body || {};

  if (!entryDate || !title) {
    return res.status(400).json({ ok: false, message: 'entryDate and title are required' });
  }

  try {
    const userId = await getUserId(user);
    const day = await getOrCreateNutritionDay(userId, entryDate);
    const result = await pool.query(
      `INSERT INTO nutrition_entries (
         nutrition_day_id, meal_type, title, quantity_text, calories, protein_g, carbs_g, fat_g, fiber_g, items_json, source_name, source_url, source_note, consumed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
       RETURNING *`,
      [day.id, mealType, title, quantityText, calories, proteinG, carbsG, fatG, fiberG, JSON.stringify(Array.isArray(items) ? items : []), sourceName, sourceUrl, sourceNote, consumedAt]
    );
    const payload = await fetchNutritionDay(user, entryDate);
    const review = await runTrainingReview(user, 7, 'nutrition_update');
    res.json({ ok: true, entry: result.rows[0], review, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(message === 'user not found' ? 404 : 500).json({ ok: false, message });
  }
});

app.get('/api/rest-timer', async (req, res) => {
  const user = String(req.query.user || 'migue');
  try {
    const timer = await getRestTimerState(user);
    res.json({ ok: true, timer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ ok: false, message });
  }
});

app.post('/api/rest-timer', async (req, res) => {
  const { user = 'migue', action, seconds } = req.body || {};

  try {
    await ensureRestTimerRow(user);

    if (action === 'preset') {
      const duration = Math.max(5, Number(seconds) || 90);
      const result = await pool.query(
        `UPDATE rest_timers
         SET duration_seconds = $2,
             remaining_seconds = $2,
             status = 'idle',
             end_at = NULL,
             updated_at = now()
         WHERE user_slug = $1
         RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at`,
        [user, duration]
      );
      return res.json({ ok: true, timer: { ...result.rows[0], server_now: new Date().toISOString() } });
    }

    if (action === 'start') {
      const current = await getRestTimerState(user);
      const duration = current.remaining_seconds > 0 ? current.remaining_seconds : current.duration_seconds;
      const result = await pool.query(
        `UPDATE rest_timers
         SET remaining_seconds = $2,
             status = 'running',
             end_at = now() + ($2::int * interval '1 second'),
             updated_at = now()
         WHERE user_slug = $1
         RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at`,
        [user, duration]
      );
      return res.json({ ok: true, timer: { ...result.rows[0], server_now: new Date().toISOString() } });
    }

    if (action === 'pause') {
      const current = await getRestTimerState(user);
      const remaining = Math.max(0, Number(current.remaining_seconds) || 0);
      const nextStatus = remaining === 0 ? 'finished' : 'paused';
      const result = await pool.query(
        `UPDATE rest_timers
         SET remaining_seconds = $2,
             status = $3,
             end_at = NULL,
             updated_at = now()
         WHERE user_slug = $1
         RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at`,
        [user, remaining, nextStatus]
      );
      return res.json({ ok: true, timer: { ...result.rows[0], server_now: new Date().toISOString() } });
    }

    if (action === 'reset') {
      const current = await getRestTimerState(user);
      const wasFinished = String(current.status || '') === 'finished';
      const result = await pool.query(
        `UPDATE rest_timers
         SET remaining_seconds = duration_seconds,
             status = 'idle',
             end_at = NULL,
             updated_at = now()
         WHERE user_slug = $1
         RETURNING user_slug, duration_seconds, remaining_seconds, status, end_at, finish_count, updated_at`,
        [user]
      );
      return res.json({
        ok: true,
        timer: {
          ...result.rows[0],
          server_now: new Date().toISOString(),
          previous_status: current.status,
          alarm_on_reset: wasFinished
        }
      });
    }

    return res.status(400).json({ ok: false, message: 'Unsupported action' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    res.status(500).json({ ok: false, message });
  }
});

app.listen(PORT, () => {
  console.log(`neo-sport-api listening on ${PORT}`);
});
