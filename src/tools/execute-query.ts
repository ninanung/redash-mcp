import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExecuteQueryArgs } from "@/interfaces/tool-args.js";

const SCHEMA_ERROR_PATTERNS = [
  /table.*not found/i,
  /column.*not found/i,
  /table.*does not exist/i,
  /column.*does not exist/i,
  /unknown table/i,
  /unknown column/i,
];

function isSchemaError(message: string): boolean {
  return SCHEMA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export async function handleExecuteQuery(
  args: ExecuteQueryArgs,
  client: RedashClient,
  schemaCache: SchemaCache
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, query } = args;

  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    return {
      content: [
        { type: "text", text: "SELECT/WITH 문만 실행할 수 있습니다." },
      ],
      isError: true,
    };
  }

  try {
    const result = await client.executeAdhocQuery(query, dataSourceId);
    const data = result.query_result.data;

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

    return {
      content: [
        {
          type: "text",
          text: resultJson,
        },
        {
          type: "text",
          text: `실행된 SQL:\n\`\`\`sql\n${query}\n\`\`\`\n\n이 쿼리를 Redash에 저장하려면 save_query 도구를 사용하세요.\n사용자에게 실행된 SQL과 함께 저장 여부 및 쿼리 이름을 확인해주세요.`,
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
