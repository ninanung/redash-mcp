import type { RedashColumn } from "@/interfaces/redash-client.js";
import type { ResultFormat } from "@/interfaces/result-format.js";
export type { ResultFormat } from "@/interfaces/result-format.js";

const FALLBACK_MAX_ROWS = 1000;
const FORMATS: ResultFormat[] = ["json", "compact"];

/** Row cap when the call passes none: REDASH_DEFAULT_MAX_ROWS, else 1000. */
export function defaultMaxRows(): number {
  const raw = process.env.REDASH_DEFAULT_MAX_ROWS;
  if (!raw) return FALLBACK_MAX_ROWS;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : FALLBACK_MAX_ROWS;
}

/** Output format when the call passes none: REDASH_DEFAULT_FORMAT, else "json". */
export function defaultFormat(): ResultFormat {
  const raw = (process.env.REDASH_DEFAULT_FORMAT ?? "").toLowerCase();
  return (FORMATS as string[]).includes(raw) ? (raw as ResultFormat) : "json";
}

export function resolveFormat(arg: unknown): ResultFormat {
  if (typeof arg === "string" && (FORMATS as string[]).includes(arg)) {
    return arg as ResultFormat;
  }
  return defaultFormat();
}

/**
 * Serialize a result payload. "json" keeps the original shape (columns as
 * objects, rows as objects, 2-space indent). "compact" emits column names and
 * types as parallel arrays and rows as arrays of values with no indentation,
 * which is roughly a quarter of the size for the same data.
 */
export function formatResult(
  format: ResultFormat,
  columns: RedashColumn[],
  rows: Record<string, unknown>[],
  extra: Record<string, unknown>
): string {
  if (format === "compact") {
    return JSON.stringify({
      ...extra,
      columns: columns.map((c) => c.name),
      column_types: columns.map((c) => c.type),
      rows: rows.map((r) => columns.map((c) => r[c.name] ?? null)),
    });
  }
  return JSON.stringify(
    {
      ...extra,
      columns: columns.map((c) => ({ name: c.name, type: c.type })),
      rows,
    },
    null,
    2
  );
}
