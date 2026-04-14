import * as fs from "fs";
import * as path from "path";
import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import { validateReadOnlySql } from "@/sql-guard.js";
import { getMaskedColumns, maskRow } from "@/masking.js";
import { computeSummary, summarizeThreshold } from "@/summarize.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExecuteQueryArgs } from "@/interfaces/tool-args.js";
import type { RedashColumn } from "@/interfaces/redash-client.js";

const SCHEMA_ERROR_PATTERNS = [
  /table.*not found/i,
  /column.*not found/i,
  /table.*does not exist/i,
  /column.*does not exist/i,
  /unknown table/i,
  /unknown column/i,
];

const DEFAULT_MAX_ROWS = 1000;

function isSchemaError(message: string): boolean {
  return SCHEMA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function hasLimitClause(sql: string): boolean {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .replace(/;+\s*$/, "");
  return /\blimit\s+\d+/i.test(stripped);
}

function injectLimit(sql: string, limit: number, offset?: number): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  const offsetClause = offset && offset > 0 ? ` OFFSET ${offset}` : "";
  return `${trimmed}\nLIMIT ${limit}${offsetClause}`;
}

function toCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(
  filePath: string,
  columns: RedashColumn[],
  rows: Record<string, unknown>[]
): string {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const header = columns.map((c) => toCsvValue(c.name)).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => toCsvValue(r[c.name])).join(",")
  );
  fs.writeFileSync(resolved, [header, ...lines].join("\n"), "utf-8");
  return resolved;
}

export async function handleExecuteQuery(
  args: ExecuteQueryArgs,
  client: RedashClient,
  schemaCache: SchemaCache
): Promise<ToolResult> {
  const {
    data_source_id: dataSourceId,
    query,
    max_rows: maxRowsArg,
    save_csv: saveCsv,
    timeout_ms: timeoutMs,
    summarize = "auto",
    offset,
  } = args;

  const guard = validateReadOnlySql(query);
  if (!guard.ok) {
    return {
      content: [{ type: "text", text: guard.reason ?? "Query rejected." }],
      isError: true,
    };
  }

  const maxRows = maxRowsArg ?? DEFAULT_MAX_ROWS;
  const limitInjected = !hasLimitClause(query);
  const effectiveQuery = limitInjected ? injectLimit(query, maxRows, offset) : query;

  if (!limitInjected && offset && offset > 0) {
    return {
      content: [
        {
          type: "text",
          text: "The query already has a LIMIT clause, so the offset argument is ignored. Either specify LIMIT/OFFSET in the SQL directly, or remove LIMIT and use max_rows/offset.",
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await client.executeAdhocQuery(effectiveQuery, dataSourceId, {
      timeoutMs,
    });
    const data = result.query_result.data;

    const columnNames = data.columns.map((c) => c.name);
    const maskedCols = getMaskedColumns(columnNames);
    if (maskedCols.length > 0) {
      data.rows = data.rows.map((r) => maskRow(r, columnNames));
    }

    const truncated = data.rows.length >= maxRows;
    const notes: string[] = [];
    if (maskedCols.length > 0) {
      notes.push(`Masked columns: ${maskedCols.join(", ")}`);
    }
    if (limitInjected) {
      notes.push(`Auto-injected LIMIT ${maxRows}.`);
    }
    if (truncated) {
      notes.push(
        `Result reached ${maxRows} rows and may have been truncated. Increase max_rows or specify LIMIT directly in the query for more rows.`
      );
    }

    let csvPath: string | null = null;
    if (saveCsv) {
      csvPath = writeCsv(saveCsv, data.columns, data.rows);
      notes.push(`Saved result to CSV: ${csvPath}`);
    }

    const threshold = summarizeThreshold();
    const shouldSummarize =
      summarize === "always" ||
      (summarize === "auto" && data.rows.length > threshold && !saveCsv);

    let resultJson: string;
    if (shouldSummarize) {
      const summary = computeSummary(data.columns, data.rows);
      resultJson = JSON.stringify(
        {
          summarized: true,
          total_rows: summary.total_rows,
          columns: summary.columns,
          sample_rows: summary.sample_rows,
          runtime: result.query_result.runtime,
        },
        null,
        2
      );
      if (summarize === "always") {
        notes.push(
          `Forced summary via summarize:"always" (${data.rows.length} rows). Omit summarize or pass "never" to get full rows.`
        );
      } else {
        notes.push(
          `Result had ${data.rows.length} rows, exceeding threshold (${threshold}), so it was summarized. Save full rows via save_csv, or call again with summarize:"never".`
        );
      }
    } else {
      resultJson = JSON.stringify(
        {
          columns: data.columns.map((c) => ({
            name: c.name,
            type: c.type,
          })),
          rows: data.rows,
          row_count: data.rows.length,
          runtime: result.query_result.runtime,
        },
        null,
        2
      );
    }

    const notesText = notes.length > 0 ? `\n\nNotes:\n- ${notes.join("\n- ")}` : "";

    return {
      content: [
        {
          type: "text",
          text: resultJson,
        },
        {
          type: "text",
          text: `Executed SQL:\n\`\`\`sql\n${effectiveQuery}\n\`\`\`${notesText}\n\nIMPORTANT: When presenting the result to the user, you MUST always include this executed SQL verbatim in a \`\`\`sql code block alongside the result. Do not omit or paraphrase it.\n\nTo save this query to Redash, use the save_query tool (ask the user for confirmation and a name).`,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (offset && offset > 0 && /OFFSET/i.test(message)) {
      return {
        content: [
          {
            type: "text",
            text: `Query failed: ${message}\n\nThe current engine does not support OFFSET (e.g. Presto <0.176). Instead of offset, paginate via a WHERE clause or ROW_NUMBER()-based logic in your query.`,
          },
        ],
        isError: true,
      };
    }

    if (isSchemaError(message) && schemaCache.isCached(dataSourceId)) {
      schemaCache.invalidate(dataSourceId);
      const refreshed = await schemaCache.getSchema(client, dataSourceId);
      const tableNames = schemaCache.getTableNames(refreshed);

      return {
        content: [
          {
            type: "text",
            text: `Query failed: ${message}\n\nSchema cache refreshed (${refreshed.length} tables). Please rewrite the query using the updated schema.\n\nTables:\n${tableNames.join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    throw error;
  }
}
