import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  postgresJsPool,
  type PgPool,
  type PgQueryable,
  type PostgresJsLike,
} from "@/server/recorder/pg";

/**
 * LOCAL, DISPOSABLE PostgreSQL for the Step B integration tests. Enabled only
 * when HISTORY_PG_HOST is set (e.g. a socket dir or 127.0.0.1); otherwise the
 * suites are skipped, so `npm test` needs no database. Refuses anything that is
 * not local. Each test database is created fresh from the real migration file
 * and dropped afterwards.
 *
 *   HISTORY_PG_HOST=/tmp/pgb HISTORY_PG_PORT=55432 HISTORY_PG_USER=root npx vitest run tests/server
 */

const HOST = process.env.HISTORY_PG_HOST;
const PORT = Number(process.env.HISTORY_PG_PORT ?? 5432);
const ADMIN = process.env.HISTORY_PG_USER ?? "postgres";

export const pgEnabled = !!HOST;
if (HOST && !(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) {
  throw new Error(`refusing non-local HISTORY_PG_HOST=${HOST}`);
}

export const MIGRATION = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260926120000_signal_history_recorder.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const connect = (database: string, username = ADMIN, max = 4) =>
  postgres({
    host: HOST,
    port: PORT,
    database,
    username,
    max,
    prepare: false, // same mode as the Supavisor transaction pooler
    onnotice: () => {},
  });

async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 50 + 50 * i));
    }
  }
}

/** Cluster-wide roles the migration expects to exist on Supabase (browser roles). */
async function ensureClusterRoles(admin: postgres.Sql) {
  for (const role of ["anon", "authenticated", "recorder_writer", "recorder_reader"]) {
    await retry(async () => {
      const [r] = await admin`select 1 as x from pg_roles where rolname = ${role}`;
      if (!r) await admin.unsafe(`create role ${role} nologin`);
    });
  }
  // Local test login only (trust auth on the local socket); B0 sets real credentials.
  for (const role of ["recorder_writer", "recorder_reader"]) {
    await retry(() => admin.unsafe(`alter role ${role} login`));
  }
}

export type TestDb = {
  name: string;
  /** Superuser connection to the test database (setup / inspection only). */
  admin: postgres.Sql;
  adminPool: PgPool;
  /** The recorder's own least-privilege role. */
  writer: postgres.Sql;
  writerPool: PgPool;
  /** The health endpoint's read-only role. */
  reader: postgres.Sql;
  drop(): Promise<void>;
};

export async function createTestDb(prefix = "stepb"): Promise<TestDb> {
  const root = connect("postgres", ADMIN, 1);
  await ensureClusterRoles(root);
  const name = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await root.unsafe(`create database ${name}`);
  const admin = connect(name);
  await admin.unsafe(MIGRATION);
  const writer = connect(name, "recorder_writer");
  const reader = connect(name, "recorder_reader", 1);
  return {
    name,
    admin,
    adminPool: postgresJsPool(admin as unknown as PostgresJsLike),
    writer,
    writerPool: postgresJsPool(writer as unknown as PostgresJsLike),
    reader,
    async drop() {
      await Promise.all([admin.end(), writer.end(), reader.end()]);
      await root.unsafe(`drop database if exists ${name} with (force)`);
      await root.end();
    },
  };
}

/** A pool whose FIRST transaction throws at its Nth statement (fault injection). */
export function faultyPool(inner: PgPool, failAtStatement: number): PgPool & { tripped: boolean } {
  let transactions = 0;
  const pool = {
    tripped: false,
    query: inner.query.bind(inner),
    transaction<T>(fn: (tx: PgQueryable) => Promise<T>): Promise<T> {
      const armed = transactions++ === 0;
      return inner.transaction((tx) => {
        let n = 0;
        const wrapped: PgQueryable = {
          query: (text, params) => {
            n++;
            if (armed && n === failAtStatement) {
              pool.tripped = true;
              return Promise.reject(new Error(`injected failure at statement ${n}`));
            }
            return tx.query(text, params);
          },
        };
        return fn(wrapped);
      });
    },
  };
  return pool;
}

/** Every row the recorder can write, for all-or-nothing comparisons. */
export async function dumpState(db: TestDb) {
  const q = (text: string) => db.admin.unsafe(text).then((rows) => JSON.stringify(rows));
  return {
    rounds: await q(`select * from history.signal_round order by key`),
    events: await q(`select * from history.signal_event order by id`),
    episodes: await q(`select * from history.signal_episode order by event_id`),
    outcomes: await q(`select * from history.signal_outcome order by event_id, horizon_minutes`),
    pending: await q(`select * from engine.pending_outcome order by event_id, horizon_minutes`),
    engine: await q(`select key, scheduled_at from engine.snapshot_round order by key`),
    cooldowns: await q(`select * from engine.provider_cooldown order by endpoint`),
  };
}
