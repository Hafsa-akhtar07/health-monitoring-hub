const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Neon / managed Postgres: must use connectionString + ssl
const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

function normalizeRemoteDatabaseUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    return url;
  }
}

const databaseUrl = normalizeRemoteDatabaseUrl(rawDatabaseUrl);

/** Single client connect timeout (1 minute) — important for Azure → Neon cold start */
const REMOTE_CONNECTION_TIMEOUT_MS = 60_000;

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: REMOTE_CONNECTION_TIMEOUT_MS,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'health_monitoring_hub',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30_000,
  ...(databaseUrl ? {} : { connectionTimeoutMillis: 10_000 }),
});

let dbInitialized = false;
let lastDbInitError = null;

function isDatabaseReady() {
  return dbInitialized;
}

function getLastDbInitError() {
  return lastDbInitError;
}

pool.on('connect', () => {
  console.log('[db] Pool client connected');
});

pool.on('error', (err) => {
  console.error('[db] Pool idle client error (app keeps running):', err.message);
  console.error('[db] Stack:', err.stack);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[db] query ok', { durationMs: duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('[db] query error:', error.message);
    throw error;
  }
};

const initializeDatabase = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'patient',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'password'
        ) THEN
          ALTER TABLE users ADD COLUMN password VARCHAR(255);
        END IF;
      END $$;
    `);
  } catch (error) {
    console.log('[db] Password column migration check:', error.message);
  }

  // Ensure `role` exists for auth/admin queries on older databases.
  try {
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'patient';
          UPDATE users SET role = 'patient' WHERE role IS NULL;
        END IF;
      END $$;
    `);
  } catch (error) {
    console.log('[db] Role column migration check:', error.message);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      filename VARCHAR(255),
      file_path VARCHAR(500),
      extracted_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS analyses (
      id SERIAL PRIMARY KEY,
      report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
      rule_based_results JSONB,
      ml_results JSONB,
      severity VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[db] Schema initialized successfully');
};

/**
 * Retry DB init for up to maxWaitMs (default 60s). Does not throw — returns { ok, error }.
 */
async function initializeDatabaseWithRetry(options = {}) {
  const maxWaitMs = options.maxWaitMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 5_000;
  const start = Date.now();
  let attempt = 0;
  lastDbInitError = null;
  dbInitialized = false;

  console.log(
    `[db] Starting initialization (retries every ${intervalMs}ms, max wait ${maxWaitMs}ms, connect timeout ${REMOTE_CONNECTION_TIMEOUT_MS}ms)`
  );

  while (Date.now() - start < maxWaitMs) {
    attempt += 1;
    const elapsed = Date.now() - start;
    try {
      console.log(`[db] Attempt ${attempt} (${elapsed}ms elapsed)...`);
      await initializeDatabase();
      dbInitialized = true;
      lastDbInitError = null;
      console.log(`[db] Ready after ${attempt} attempt(s), ${Date.now() - start}ms total`);
      return { ok: true, attempts: attempt, ms: Date.now() - start };
    } catch (err) {
      lastDbInitError = err;
      console.error(`[db] Attempt ${attempt} failed:`, err.message);
      if (err.cause) console.error('[db] Cause:', err.cause.message || err.cause);

      const remaining = maxWaitMs - (Date.now() - start);
      if (remaining <= intervalMs) {
        console.error(`[db] Giving up after ${attempt} attempts (${Date.now() - start}ms). App will still start.`);
        break;
      }
      console.log(`[db] Waiting ${intervalMs}ms before retry (${remaining}ms left in window)...`);
      await sleep(intervalMs);
    }
  }

  dbInitialized = false;
  return {
    ok: false,
    attempts: attempt,
    ms: Date.now() - start,
    error: lastDbInitError?.message || 'unknown',
  };
}

module.exports = {
  pool,
  query,
  initializeDatabase,
  initializeDatabaseWithRetry,
  isDatabaseReady,
  getLastDbInitError,
};
