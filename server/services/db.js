/**
 * PostgreSQL connection pool (lazy).
 * Returns null when no DATABASE_URL is configured, so callers can fall back
 * to the built-in sample data.
 */
import pg from 'pg';
import { config } from '../config.js';

let pool = null;

export function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 5,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  return pool;
}
