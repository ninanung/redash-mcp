import type { RedashColumn } from "@/interfaces/redash-client.js";

const DEFAULT_THRESHOLD = 500;
const SAMPLE_LIMIT = 10;

export function summarizeThreshold(): number {
  const raw = process.env.REDASH_SUMMARIZE_THRESHOLD;
  if (!raw) return DEFAULT_THRESHOLD;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

export interface ColumnStats {
  name: string;
  type: string;
  distinct_count: number;
  null_count: number;
  min: string | number | null;
  max: string | number | null;
}

export interface Summary {
  total_rows: number;
  columns: ColumnStats[];
  sample_rows: Record<string, unknown>[];
}

function isComparable(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number";
}

export function computeSummary(
  columns: RedashColumn[],
  rows: Record<string, unknown>[]
): Summary {
  const stats: ColumnStats[] = columns.map((c) => {
    const distinct = new Set<unknown>();
    let nullCount = 0;
    let min: string | number | null = null;
    let max: string | number | null = null;

    for (const row of rows) {
      const v = row[c.name];
      if (v === null || v === undefined) {
        nullCount++;
        continue;
      }
      distinct.add(v);
      if (isComparable(v)) {
        if (min === null || v < min) min = v;
        if (max === null || v > max) max = v;
      }
    }

    return {
      name: c.name,
      type: c.type,
      distinct_count: distinct.size,
      null_count: nullCount,
      min,
      max,
    };
  });

  return {
    total_rows: rows.length,
    columns: stats,
    sample_rows: rows.slice(0, SAMPLE_LIMIT),
  };
}
