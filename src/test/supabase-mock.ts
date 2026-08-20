import { vi } from 'vitest';

export interface TableResult {
  data: unknown;
  error?: unknown;
}

export interface SupabaseMockConfig {
  user?: { id: string } | null;
  /** Result returned for every query against the given table name. */
  tables?: Record<string, TableResult>;
  /** Result returned for `.single()` when it should differ from the table result. */
  singles?: Record<string, TableResult>;
}

/**
 * Minimal chainable stand-in for the supabase-js query builder: every filter
 * method returns the builder, and awaiting it (or calling `single()`) resolves
 * to the result configured for the table.
 */
class QueryBuilder implements PromiseLike<TableResult> {
  constructor(
    private readonly result: TableResult,
    private readonly singleResult: TableResult
  ) {}

  select = vi.fn(() => this);
  insert = vi.fn(() => this);
  update = vi.fn(() => this);
  upsert = vi.fn(() => this);
  delete = vi.fn(() => this);
  eq = vi.fn(() => this);
  neq = vi.fn(() => this);
  in = vi.fn(() => this);
  or = vi.fn(() => this);
  ilike = vi.fn(() => this);
  order = vi.fn(() => this);
  limit = vi.fn(() => this);

  single = vi.fn(() => Promise.resolve(this.singleResult));
  maybeSingle = vi.fn(() => Promise.resolve(this.singleResult));

  then<TResult1 = TableResult, TResult2 = never>(
    onfulfilled?: ((value: TableResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

export function createSupabaseMock(config: SupabaseMockConfig = {}) {
  const { user = { id: 'user-1' }, tables = {}, singles = {} } = config;
  const builders = new Map<string, QueryBuilder>();

  const from = vi.fn((table: string) => {
    const existing = builders.get(table);
    if (existing) return existing;

    const result = tables[table] ?? { data: null, error: null };
    const builder = new QueryBuilder(result, singles[table] ?? result);
    builders.set(table, builder);
    return builder;
  });

  return {
    supabase: {
      from,
      auth: {
        getUser: vi.fn(async () => ({ data: { user }, error: null })),
        getSession: vi.fn(async () => ({
          data: { session: user ? { user } : null },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
        signInWithPassword: vi.fn(async () => ({ data: { user }, error: null })),
        signUp: vi.fn(async () => ({ data: { user }, error: null })),
        signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
    from,
    builderFor: (table: string) => builders.get(table),
  };
}
