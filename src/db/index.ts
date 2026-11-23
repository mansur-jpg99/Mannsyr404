import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: NodePgDatabase<typeof schema> | undefined;
}

export function isSqlDatabaseConfigured(): boolean {
  if (process.env.USE_SUPABASE_DB === 'true') {
    return false;
  }
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.SQL_HOST
  );
}

// Alias dipertahankan agar kompatibel dengan modul yang memeriksa SQL config
export const isDatabaseConfigured = isSqlDatabaseConfigured;

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

export function getSqlDb(): NodePgDatabase<typeof schema> {
  if (!global._drizzleDb) {
    global._drizzleDb = drizzle(createPool(), { schema });
  }
  return global._drizzleDb;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getSqlDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
