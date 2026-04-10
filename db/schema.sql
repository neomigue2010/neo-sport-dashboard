CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  muscle_group TEXT,
  equipment TEXT,
  unilateral BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  training_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'rest', 'skipped')),
  focus TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, training_date)
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id UUID NOT NULL UNIQUE REFERENCES workout_days(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  perceived_energy INTEGER CHECK (perceived_energy BETWEEN 1 AND 10),
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
  body_weight_kg NUMERIC(6,2),
  notes TEXT,
  coach_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercise_catalog(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER,
  target_reps TEXT,
  target_weight_kg NUMERIC(6,2),
  target_notes TEXT,
  actual_sets INTEGER,
  actual_notes TEXT,
  actual_calories_burned NUMERIC(8,2),
  is_logged BOOLEAN NOT NULL DEFAULT FALSE,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id UUID NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg NUMERIC(6,2),
  rir INTEGER,
  effort INTEGER CHECK (effort BETWEEN 1 AND 10),
  completed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_exercise_id, set_number)
);

CREATE TABLE IF NOT EXISTS routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routine_template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_template_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercise_catalog(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER,
  target_reps TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutrition_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

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
);

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
);

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
);

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
);

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
);

CREATE INDEX IF NOT EXISTS idx_workout_days_user_date ON workout_days(user_id, training_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON workout_sessions(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session_order ON workout_session_exercises(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sets_session_exercise ON exercise_sets(session_exercise_id, set_number);
CREATE INDEX IF NOT EXISTS idx_nutrition_days_user_date ON nutrition_days(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_entries_day ON nutrition_entries(nutrition_day_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_training_reviews_user_created ON training_reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_measured ON body_metrics(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_neo_day_notes_user_date ON neo_day_notes(user_id, note_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_programming_reviews_user_week ON weekly_programming_reviews(user_id, week_start_date DESC, created_at DESC);

INSERT INTO app_users (slug, display_name)
VALUES ('migue', 'Migue')
ON CONFLICT (slug) DO NOTHING;
