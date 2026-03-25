const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Neon / managed Postgres: must use connectionString + ssl (Neon does not accept non-SSL the same way).
const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

/**
 * node-postgres + Neon: short client timeouts (default) often cause
 * "Connection terminated due to connection timeout" on slow / long routes.
 * channel_binding=require can also confuse some pg versions — Neon works fine without it.
 */
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

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      // Long haul / first connection to Neon needs more than 2s
      connectionTimeoutMillis: 60000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  : {
      // Fallback for local/CI when DATABASE_URL is not set (e.g. docker postgres + DB_* env vars)
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
  idleTimeoutMillis: 30000,
  // Local / CI fallback: reasonable timeout for localhost Postgres
  ...(databaseUrl ? {} : { connectionTimeoutMillis: 10000 }),
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password VARCHAR(255) NOT NULL,
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
      console.log('Password column check completed');
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

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

module.exports = {
  pool,
  query,
  initializeDatabase,
};
