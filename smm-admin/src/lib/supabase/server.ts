/**
 * Mock Supabase server client — wraps PostgreSQL + JWT auth.
 * Provides the same interface as @supabase/ssr so all existing
 * page/API route code works without modification.
 */
import { cookies } from "next/headers";
import pool from "../db";
import { verifyToken, createUser, findUserByCredentials, signToken } from "../auth";
import type { Database } from "./types";

// ─── Foreign-key map for embedded relation queries ─────────────────────────
// "from(table).select('role, clients(*)')" needs to know which FK links tables
const RELATIONS: Record<string, Record<string, string>> = {
  client_users: { clients: "client_id" },
  invites: { clients: "client_id" },
};

// ─── Column name validation ────────────────────────────────────────────────
function safeColumn(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
  return `"${name}"`;
}

// ─── QueryBuilder ──────────────────────────────────────────────────────────
type QBResult = { data: unknown; error: { message: string; code?: string } | null };

function parseEmbeds(table: string, cols: string) {
  const embeds: { name: string; fk: string; columns: string }[] = [];
  const embedRe = /(\w+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  let mainCols = cols;
  while ((m = embedRe.exec(cols)) !== null) {
    const relTable = m[1];
    const relCols = m[2];
    const fk = RELATIONS[table]?.[relTable];
    if (fk) {
      embeds.push({ name: relTable, fk, columns: relCols });
      mainCols = mainCols.replace(m[0], "").replace(/,\s*,/g, ",").replace(/^,\s*/,"").replace(/,\s*$/,"").trim();
    }
  }
  return { mainCols: mainCols || "*", embeds };
}

class QueryBuilder {
  private _table: string;
  private _cols = "*";
  private _conds: [string, unknown][] = [];
  private _single = false;
  private _orderCol?: string;
  private _orderAsc = true;
  private _limitN?: number;
  private _op: "select" | "insert" | "update" = "select";
  private _data?: Record<string, unknown>;
  private _afterInsertSelect = false;

  constructor(table: string) {
    this._table = table;
  }

  select(cols = "*") {
    if (this._op === "insert") {
      // post-insert select — keep insert op, just mark returning
      this._afterInsertSelect = true;
      return this;
    }
    this._op = "select";
    this._cols = cols;
    return this;
  }
  eq(col: string, val: unknown) { this._conds.push([col, val]); return this; }
  single() { this._single = true; return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) { this._limitN = n; return this; }

  insert(data: Record<string, unknown>) {
    this._op = "insert";
    this._data = data;
    return this;
  }
  update(data: Record<string, unknown>) {
    this._op = "update";
    this._data = data;
    return this;
  }
  // After insert().select().single() — return inserted row
  // select() is already defined — detect call after insert by checking op
  // Overloading: if called after insert, mark _afterInsertSelect
  // Handled by treating insert as always RETURNING *

  // Make awaitable
  then(resolve: (v: QBResult) => unknown, reject: (e: unknown) => unknown) {
    return this._run().then(resolve, reject);
  }

  private async _run(): Promise<QBResult> {
    try {
      switch (this._op) {
        case "select": return await this._runSelect();
        case "insert": return await this._runInsert();
        case "update": return await this._runUpdate();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message: msg } };
    }
    return { data: null, error: { message: "Unknown op" } };
  }

  private buildWhere(prefix = "", offset = 0) {
    if (!this._conds.length) return { clause: "", params: [] as unknown[] };
    const parts = this._conds.map(([c], i) => `${prefix}${safeColumn(c)} = $${i + 1 + offset}`);
    return { clause: " WHERE " + parts.join(" AND "), params: this._conds.map(([, v]) => v) };
  }

  private async _runSelect(): Promise<QBResult> {
    const { mainCols, embeds } = parseEmbeds(this._table, this._cols);

    let selectExpr: string;
    let joinExpr = "";

    if (embeds.length > 0) {
      // Build SELECT with subquery expressions for embedded relations
      const embedExprs = embeds.map(({ name, fk, columns }) => {
        if (columns === "*") {
          return `(SELECT row_to_json(x) FROM (SELECT * FROM "${name}" WHERE id = t."${fk}") x) AS "${name}"`;
        }
        const jsonPairs = columns.split(",").map((c) => {
          const col = c.trim();
          return `'${col}', x.${col}`;
        });
        return `(SELECT json_build_object(${jsonPairs.join(", ")}) FROM "${name}" x WHERE x.id = t."${fk}") AS "${name}"`;
      });

      const mainExpr = mainCols === "*" ? "t.*" : mainCols.split(",").map((c) => `t.${c.trim()}`).join(", ");
      selectExpr = `${mainExpr}, ${embedExprs.join(", ")}`;
    } else {
      selectExpr = mainCols === "*" ? "*" : mainCols.split(",").map((c) => c.trim()).join(", ");
    }

    const tableAlias = embeds.length > 0 ? `"${this._table}" t${joinExpr}` : `"${this._table}"`;
    const condPrefix = embeds.length > 0 ? "t." : "";
    const { clause, params } = this.buildWhere(condPrefix);

    let sql = `SELECT ${selectExpr} FROM ${tableAlias}${clause}`;
    if (this._orderCol) sql += ` ORDER BY ${condPrefix}${safeColumn(this._orderCol)} ${this._orderAsc ? "ASC" : "DESC"}`;
    if (this._single) sql += " LIMIT 1";
    else if (this._limitN !== undefined) sql += ` LIMIT ${this._limitN}`;

    const { rows } = await pool.query(sql, params);

    if (this._single) {
      if (!rows.length) return { data: null, error: { message: "Row not found", code: "PGRST116" } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }

  private async _runInsert(): Promise<QBResult> {
    const data = this._data!;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO "${this._table}" (${cols.map((c) => safeColumn(c)).join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const { rows } = await pool.query(sql, vals);
    const row = rows[0] ?? null;

    // Handle unique constraint violation
    if (!row) return { data: null, error: { message: "Insert failed" } };
    return this._single ? { data: row, error: null } : { data: rows, error: null };
  }

  private async _runUpdate(): Promise<QBResult> {
    const data = this._data!;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const sets = cols.map((c, i) => `${safeColumn(c)} = $${i + 1}`).join(", ");
    const { clause, params } = this.buildWhere("", cols.length);
    const sql = `UPDATE "${this._table}" SET ${sets}${clause}`;
    await pool.query(sql, [...vals, ...params]);
    return { data: null, error: null };
  }
}

// ─── Mock auth object ─────────────────────────────────────────────────────
async function getUserFromCookies() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sb_token")?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

function makeAuth(isServiceRole = false) {
  return {
    async getUser() {
      const user = await getUserFromCookies();
      return { data: { user: user ? { id: user.id, email: user.email, role: user.role } : null }, error: null };
    },
    admin: {
      async createUser({ email, password }: { email: string; password: string; email_confirm?: boolean }) {
        try {
          const user = await createUser(email, password);
          return { data: { user: { id: user.id, email: user.email } }, error: null };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Create user failed";
          const code = msg.includes("duplicate") || msg.includes("unique") ? "email_exists" : "unknown";
          return { data: { user: null }, error: { message: msg, code } };
        }
      },
    },
  };
}

// ─── Exported factory functions ───────────────────────────────────────────
type MockClient = {
  auth: ReturnType<typeof makeAuth>;
  from: (table: string) => QueryBuilder;
};

export async function createClient(): Promise<MockClient> {
  return {
    auth: makeAuth(false),
    from: (table: string) => new QueryBuilder(table),
  };
}

export async function createServiceClient(): Promise<MockClient> {
  return {
    auth: makeAuth(true),
    from: (table: string) => new QueryBuilder(table),
  };
}
