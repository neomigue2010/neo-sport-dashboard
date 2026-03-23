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
  target_notes TEXT,
  actual_notes TEXT,
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

CREATE INDEX IF NOT EXISTS idx_workout_days_user_date ON workout_days(user_id, training_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON workout_sessions(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session_order ON workout_session_exercises(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sets_session_exercise ON exercise_sets(session_exercise_id, set_number);

INSERT INTO app_users (slug, display_name)
VALUES ('migue', 'Migue')
ON CONFLICT (slug) DO NOTHING;
