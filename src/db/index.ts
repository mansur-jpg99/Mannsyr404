import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.SQL_HOST
  );
}

function getPoolConfig() {
  const connectionString = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ''
  ).trim();

  if (connectionString) {
    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1');
    return {
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  }

  return {
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 10,
    connectionTimeoutMillis: 15000,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(getPoolConfig());

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
