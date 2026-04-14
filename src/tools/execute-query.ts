import * as fs from "fs";
import * as path from "path";
import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
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

function injectLimit(sql: string, limit: number): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  return `${trimmed}\nLIMIT ${limit}`;
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
  } = args;

  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    return {
      content: [
        { type: "text", text: "SELECT/WITH 문만 실행할 수 있습니다." },
      ],
      isError: true,
    };
  }

  const maxRows = maxRowsArg ?? DEFAULT_MAX_ROWS;
  const limitInjected = !hasLimitClause(query);
  const effectiveQuery = limitInjected ? injectLimit(query, maxRows) : query;

  try {
    const result = await client.executeAdhocQuery(effectiveQuery, dataSourceId);
    const data = result.query_result.data;

    const truncated = data.rows.length >= maxRows;
    const notes: string[] = [];
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

    const resultJson = JSON.stringify(
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
