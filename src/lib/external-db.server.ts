/**
 * Puente entre el estilo de consulta que ya usa la aplicación y la API propia
 * (PHP + MySQL). Implementa el subconjunto de operaciones que emplean los
 * módulos de evaluaciones: filtros de igualdad, `in`, `ilike`, orden, límite,
 * inserción, actualización, borrado y `upsert`.
 *
 * Server-only: importar siempre con `await import(...)` dentro del handler.
 */

import { externalApi, type ExternalResource } from "./external-data.server";

export type ExternalTable = ExternalResource;

type Row = Record<string, unknown>;
type Res<T> = { data: T; error: { message: string } | null };

type Filter =
  | { op: "eq"; column: string; value: unknown }
  | { op: "in"; column: string; values: unknown[] }
  | { op: "ilike"; column: string; pattern: string }
  | { op: "isnull"; column: string }
  | { op: "notnull"; column: string }
  | { op: "cmp"; column: string; kind: "lt" | "lte" | "gt" | "gte"; value: unknown };

/**
 * Clave primaria por tabla. La mayoría usa `id`; las tablas de una fila por
 * usuario usan `user_id`.
 */
const PRIMARY_KEYS: Record<string, string> = {
  capture_preferences: "user_id",
  user_billing: "user_id",
};

function pkFor(table: string): string {
  return PRIMARY_KEYS[table] ?? "id";
}


/** Relación incrustada del estilo `alias:tabla(columnas)`. */
interface Embed {
  alias: string;
  table: string;
  fk: string;
}

const EMBED_RE = /(?:(\w+)\s*:\s*)?(\w+)\s*\(([^()]*)\)/g;

function foreignKeyFor(table: string): string {
  return `${table.replace(/ies$/, "y").replace(/s$/, "")}_id`;
}

type Mode = "select" | "insert" | "update" | "delete" | "upsert";

interface Ctx {
  /** Token del usuario firmado; vacío = modo servicio (clave compartida). */
  accessToken: string;
  service: boolean;
}

/** Normaliza para comparar: los booleanos llegan de MySQL como 1/0. */
function norm(value: unknown): string {
  if (value === true) return "1";
  if (value === false) return "0";
  return String(value ?? "");
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const value = row[f.column];
    if (f.op === "isnull") return value === null || value === undefined;
    if (f.op === "notnull") return value !== null && value !== undefined;
    if (f.op === "eq") return norm(value) === norm(f.value);
    if (f.op === "in") return f.values.some((v) => norm(v) === norm(value));
    if (f.op === "cmp") {
      if (value === null || value === undefined) return false;
      const a = norm(value);
      const b = norm(f.value);
      if (f.kind === "lt") return a < b;
      if (f.kind === "lte") return a <= b;
      if (f.kind === "gt") return a > b;
      return a >= b;
    }
    const needle = f.pattern.replace(/%/g, "").toLowerCase();
    return String(value ?? "").toLowerCase().includes(needle);
  });
}


class ExternalQuery<T> implements PromiseLike<Res<T>> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private wantSingle: false | "single" | "maybe" = false;
  private returnRows = true;
  private embeds: Embed[] = [];

  constructor(
    private table: ExternalTable,
    private ctx: Ctx,
    private mode: Mode,
    private payload: Row[] = [],
    private conflict: string[] = [],
  ) {
    if (mode !== "select") this.returnRows = false;
  }

  select(columns?: string) {
    this.returnRows = true;
    this.embeds = [];
    for (const match of (columns ?? "").matchAll(EMBED_RE)) {
      const table = match[2] ?? "";
      if (!table) continue;
      this.embeds.push({ alias: match[1] ?? table, table, fk: foreignKeyFor(table) });
    }
    return this as unknown as ExternalQuery<Row[]>;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ op: "in", column, values });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ op: "ilike", column, pattern });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push(value === null ? { op: "isnull", column } : { op: "eq", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) this.filters.push({ op: "notnull", column });
    else if (operator === "eq") this.filters.push({ op: "notnull", column });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitN = count;
    return this;
  }

  single() {
    this.wantSingle = "single";
    return this as unknown as ExternalQuery<Row>;
  }

  maybeSingle() {
    this.wantSingle = "maybe";
    return this as unknown as ExternalQuery<Row | null>;
  }

  then<R1 = Res<T>, R2 = never>(
    onfulfilled?: ((value: Res<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled as never, onrejected as never);
  }

  private token() {
    return this.ctx.service ? "" : this.ctx.accessToken;
  }

  private async fetchRows(): Promise<Row[]> {
    const query: Record<string, string | number | boolean | undefined> = {};
    for (const f of this.filters) {
      if (f.op === "eq") query[f.column] = norm(f.value);
    }
    if (this.orderBy) query["order"] = `${this.orderBy.column}.${this.orderBy.ascending ? "asc" : "desc"}`;
    query["limit"] = Math.min(200, this.limitN ?? 200);

    const idFilter = this.filters.find((f) => f.op === "eq" && f.column === "id");
    if (idFilter && this.filters.length === 1) {
      try {
        const row = await externalApi.get<Row>(this.token(), this.table, String((idFilter as { value: unknown }).value));
        return row ? [row] : [];
      } catch (error) {
        if ((error as { status?: number }).status === 404) return [];
        throw error;
      }
    }

    const rows = await externalApi.list<Row>(this.token(), this.table, query);
    return rows.filter((row) => matches(row, this.filters));
  }

  /** Rellena las relaciones incrustadas (`alias:tabla(...)`) con una consulta por fila. */
  private async hydrate(rows: Row[]): Promise<Row[]> {
    if (this.embeds.length === 0 || rows.length === 0) return rows;
    const token = this.token();
    for (const embed of this.embeds) {
      const cache = new Map<string, Row | null>();
      for (const row of rows) {
        const id = row[embed.fk];
        if (id === null || id === undefined || id === "") {
          row[embed.alias] = null;
          continue;
        }
        const key = String(id);
        if (!cache.has(key)) {
          const parent = await externalApi
            .get<Row>(token, embed.table as ExternalResource, key)
            .catch(() => null);
          cache.set(key, parent ?? null);
        }
        row[embed.alias] = cache.get(key) ?? null;
      }
    }
    return rows;
  }

  private async run(): Promise<Res<T>> {
    try {
      const rows = await this.hydrate(await this.execute());
      const limited = this.limitN !== null ? rows.slice(0, this.limitN) : rows;
      if (this.wantSingle === "single") {
        if (limited.length === 0) {
          return { data: null as never, error: { message: "No se ha encontrado el registro" } };
        }
        return { data: limited[0] as never, error: null };
      }
      if (this.wantSingle === "maybe") {
        return { data: (limited[0] ?? null) as never, error: null };
      }
      return { data: (this.returnRows ? limited : null) as never, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[external-db] ${this.mode} ${this.table}: ${message}`);
      return { data: null as never, error: { message } };
    }
  }

  private async execute(): Promise<Row[]> {
    const token = this.token();
    if (this.mode === "select") return this.fetchRows();

    if (this.mode === "insert") {
      const created: Row[] = [];
      for (const body of this.payload) {
        created.push(await externalApi.create<Row>(token, this.table, body));
      }
      return created;
    }

    if (this.mode === "upsert") {
      const saved: Row[] = [];
      for (const body of this.payload) {
        const keys = this.conflict.length > 0 ? this.conflict : ["id"];
        const lookup: Record<string, string | number | boolean | undefined> = {};
        for (const key of keys) lookup[key] = String(body[key] ?? "");
        const existing = (await externalApi.list<Row>(token, this.table, { ...lookup, limit: 1 }))[0];
        saved.push(
          existing
            ? await externalApi.update<Row>(token, this.table, String(existing["id"]), body)
            : await externalApi.create<Row>(token, this.table, body),
        );
      }
      return saved;
    }

    const targets = await this.fetchRows();
    const result: Row[] = [];
    for (const row of targets) {
      const id = String(row["id"]);
      if (this.mode === "update") {
        result.push(await externalApi.update<Row>(token, this.table, id, this.payload[0] ?? {}));
      } else {
        await externalApi.remove(token, this.table, id);
        result.push(row);
      }
    }
    return result;
  }
}

/** Constructor de consultas para una tabla que ya vive en la base externa. */
export function externalTable(table: ExternalTable, ctx: Ctx) {
  return {
    select: (columns?: string) => new ExternalQuery<Row[]>(table, ctx, "select").select(columns),
    insert: (payload: Row | Row[]) =>
      new ExternalQuery<Row[]>(table, ctx, "insert", Array.isArray(payload) ? payload : [payload]),
    update: (payload: Row) => new ExternalQuery<Row[]>(table, ctx, "update", [payload]),
    delete: () => new ExternalQuery<Row[]>(table, ctx, "delete"),
    upsert: (payload: Row | Row[], options?: { onConflict?: string }) =>
      new ExternalQuery<Row[]>(
        table,
        ctx,
        "upsert",
        Array.isArray(payload) ? payload : [payload],
        (options?.onConflict ?? "id").split(",").map((c) => c.trim()),
      ),
  };
}
