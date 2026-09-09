import type { RedashSchemaTable } from "@/interfaces/redash-client.js";

const COLUMN_ERROR_PATTERNS = [
  /column\s+'?"?([\w.]+)'?"?\s+cannot be resolved/i,
  /unknown column\s+'?"?([\w.]+)'?"?/i,
  /column\s+'?"?([\w.]+)'?"?\s+(?:not found|does not exist)/i,
  /no such column:?\s+'?"?([\w.]+)'?"?/i,
];

const TABLE_ERROR_PATTERNS = [
  /table\s+'?"?([\w.]+)'?"?\s+(?:does not exist|doesn't exist|not found)/i,
  /unknown table\s+'?"?([\w.]+)'?"?/i,
  /no such table:?\s+'?"?([\w.]+)'?"?/i,
];

const MAX_TABLE_SUGGESTIONS = 50;

/** The offending table name when the error is a missing-table error, else null. */
export function extractMissingTable(message: string): string | null {
  for (const p of TABLE_ERROR_PATTERNS) {
    const m = p.exec(message);
    if (m) return m[1];
  }
  return null;
}

/**
 * Tables whose name resembles the missing one: first by the bare table name,
 * then by its underscore-separated tokens. Capped so the hint stays small.
 */
export function suggestSimilarTables(
  schema: RedashSchemaTable[],
  missingTable: string
): string[] {
  const bare = missingTable.split(".").pop()?.toLowerCase() ?? "";
  if (!bare) return [];
  const byName = schema
    .filter((t) => t.name.toLowerCase().includes(bare))
    .map((t) => t.name);
  if (byName.length > 0) return byName.slice(0, MAX_TABLE_SUGGESTIONS);

  const tokens = bare.split(/[_\d]+/).filter((tok) => tok.length >= 3);
  if (tokens.length === 0) return [];
  return schema
    .filter((t) => {
      const name = t.name.toLowerCase();
      return tokens.some((tok) => name.includes(tok));
    })
    .map((t) => t.name)
    .slice(0, MAX_TABLE_SUGGESTIONS);
}

export function formatTableHint(
  missingTable: string,
  suggestions: string[],
  totalTables: number
): string {
  if (suggestions.length === 0) {
    return `Table '${missingTable}' was not found among ${totalTables} tables in this data source (schema refreshed). Call get_schema with keywords or find_table to locate the right table.`;
  }
  return `Table '${missingTable}' was not found (schema refreshed, ${totalTables} tables). Similar table names:\n${suggestions.join("\n")}\n\nRewrite the query with one of these, or call get_schema with keywords to search further.`;
}

/** The offending column name when the error is a missing-column error, else null. */
export function extractMissingColumn(message: string): string | null {
  for (const p of COLUMN_ERROR_PATTERNS) {
    const m = p.exec(message);
    if (m) return m[1];
  }
  return null;
}

/**
 * Table names referenced by FROM / JOIN. Subqueries and CTE names are dropped
 * because they never resolve against the schema anyway.
 */
export function extractReferencedTables(sql: string): string[] {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const cteNames = new Set<string>();
  for (const m of stripped.matchAll(/\b(\w+)\s+as\s*\(/gi)) {
    cteNames.add(m[1].toLowerCase());
  }
  const names: string[] = [];
  for (const m of stripped.matchAll(/\b(?:from|join)\s+([`"\w.]+)/gi)) {
    const raw = m[1].replace(/[`"]/g, "");
    if (!raw || cteNames.has(raw.toLowerCase())) continue;
    if (!names.includes(raw)) names.push(raw);
  }
  return names;
}

/**
 * Schema entries matching the referenced names. A bare "table" matches a
 * schema-qualified "schema.table"; comparison is case-insensitive.
 */
export function findTablesInSchema(
  schema: RedashSchemaTable[],
  referenced: string[]
): RedashSchemaTable[] {
  const found: RedashSchemaTable[] = [];
  for (const ref of referenced) {
    const lower = ref.toLowerCase();
    const match = schema.find((t) => {
      const name = t.name.toLowerCase();
      return name === lower || name.endsWith(`.${lower}`);
    });
    if (match && !found.includes(match)) found.push(match);
  }
  return found;
}

export function formatColumnHint(
  missingColumn: string,
  tables: RedashSchemaTable[]
): string {
  const lines = tables.map(
    (t) => `${t.name} (${t.columns.length} columns): ${t.columns.join(", ")}`
  );
  return `Column '${missingColumn}' does not exist in the referenced table(s). Actual columns:\n${lines.join("\n")}\n\nRewrite the query using one of these columns.`;
}
