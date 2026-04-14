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
      content: [{ type: "text", text: guard.reason ?? "쿼리가 거부되었습니다." }],
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
          text: "쿼리에 이미 LIMIT 절이 있어 offset 인자가 무시됩니다. LIMIT/OFFSET을 SQL에 직접 지정하거나 LIMIT을 제거하고 max_rows/offset을 사용하세요.",
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
      notes.push(`마스킹된 컬럼: ${maskedCols.join(", ")}`);
    }
    if (limitInjected) {
      notes.push(`LIMIT ${maxRows}을 자동 주입했습니다.`);
    }
    if (truncated) {
      notes.push(
        `결과가 ${maxRows}행에 도달하여 잘렸을 수 있습니다. 더 많은 행이 필요하면 max_rows를 늘리거나 쿼리에 LIMIT을 직접 지정하세요.`
      );
    }

    let csvPath: string | null = null;
    if (saveCsv) {
      csvPath = writeCsv(saveCsv, data.columns, data.rows);
      notes.push(`결과를 CSV로 저장했습니다: ${csvPath}`);
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
      notes.push(
        `결과가 ${data.rows.length}행으로 임계치(${threshold})를 초과하여 요약되었습니다. 전체 행은 save_csv로 파일 저장하거나 summarize:"never"로 다시 호출하세요.`
      );
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

    const notesText = notes.length > 0 ? `\n\n주의:\n- ${notes.join("\n- ")}` : "";

    return {
      content: [
        {
          type: "text",
          text: resultJson,
        },
        {
          type: "text",
          text: `실행된 SQL:\n\`\`\`sql\n${effectiveQuery}\n\`\`\`${notesText}\n\n이 쿼리를 Redash에 저장하려면 save_query 도구를 사용하세요.\n사용자에게 실행된 SQL과 함께 저장 여부 및 쿼리 이름을 확인해주세요.`,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSchemaError(message) && schemaCache.isCached(dataSourceId)) {
      schemaCache.invalidate(dataSourceId);
      const refreshed = await schemaCache.getSchema(client, dataSourceId);
      const tableNames = schemaCache.getTableNames(refreshed);

      return {
        content: [
          {
            type: "text",
            text: `쿼리 실패: ${message}\n\n스키마 캐시를 갱신했습니다 (${refreshed.length}개 테이블). 갱신된 스키마로 쿼리를 다시 작성해주세요.\n\n테이블 목록:\n${tableNames.join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    throw error;
  }
}
