import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __neoSportPool: Pool | undefined;
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

export function hasDatabase() {
  return Boolean(getDatabaseUrl());
}

export function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!global.__neoSportPool) {
    global.__neoSportPool = new Pool({ connectionString });
  }

  return global.__neoSportPool;
}

export async function getDashboardCounts() {
  const pool = getPool();
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM app_users) AS users,
      (SELECT COUNT(*)::int FROM workout_days) AS workout_days,
      (SELECT COUNT(*)::int FROM workout_sessions) AS workout_sessions,
      (SELECT COUNT(*)::int FROM exercise_catalog) AS exercise_catalog,
      (SELECT COUNT(*)::int FROM routine_templates) AS routine_templates
  `;

  const result = await pool.query(query);
  return result.rows[0];
}
