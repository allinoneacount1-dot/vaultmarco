/**
 * Minimal database port for the server recorder. The store speaks plain SQL
 * with positional parameters through this interface, so it depends on no
 * driver. `postgresJsPool` adapts postgres.js (used by the Deno Edge Function
 * via `npm:postgres` and by the local integration tests).
 */

export type Row = Record<string, unknown>;

export interface PgQueryable {
  query<R extends Row = Row>(text: string, params?: readonly unknown[]): Promise<R[]>;
}

export interface PgPool extends PgQueryable {
  /** Run `fn` in one transaction: COMMIT on success, ROLLBACK if it throws. */
  transaction<T>(fn: (tx: PgQueryable) => Promise<T>): Promise<T>;
}

/** The subset of a postgres.js `Sql` instance this adapter uses. */
export type PostgresJsLike = {
  unsafe(text: string, params?: unknown[]): PromiseLike<unknown>;
  begin(fn: (tx: PostgresJsLike) => Promise<unknown>): PromiseLike<unknown>;
};

/**
 * postgres.js adapter. Create the client with `prepare: false` when connecting
 * through the Supavisor transaction pooler (port 6543).
 */
export function postgresJsPool(sql: PostgresJsLike): PgPool {
  const wrap = (s: PostgresJsLike): PgQueryable => ({
    query: async <R extends Row>(text: string, params: readonly unknown[] = []) => [
      ...((await s.unsafe(text, [...params])) as Iterable<R>),
    ],
  });
  return {
    ...wrap(sql),
    transaction: async <T>(fn: (tx: PgQueryable) => Promise<T>) =>
      (await sql.begin((tx) => fn(wrap(tx)))) as T,
  };
}
