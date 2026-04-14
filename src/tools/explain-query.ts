import { RedashClient } from "@/redash-client.js";
import { validateReadOnlySql } from "@/sql-guard.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExplainQueryArgs } from "@/interfaces/tool-args.js";

export async function handleExplainQuery(
  args: ExplainQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, query } = args;

  const guard = validateReadOnlySql(query);
  if (!guard.ok) {
    return {
      content: [{ type: "text", text: guard.reason ?? "쿼리가 거부되었습니다." }],
      isError: true,
    };
  }

  const stripped = query.trim().replace(/;+\s*$/, "");
  const explainSql = `EXPLAIN ${stripped}`;

  try {
    const result = await client.executeAdhocQuery(explainSql, dataSourceId);
    const data = result.query_result.data;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              columns: data.columns.map((c) => ({ name: c.name, type: c.type })),
              rows: data.rows,
              runtime: result.query_result.runtime,
            },
            null,
            2
          ),
        },
        {
          type: "text",
          text: `실행된 SQL:\n\`\`\`sql\n${explainSql}\n\`\`\`\n\n주의: EXPLAIN 구문은 데이터소스 엔진(PostgreSQL, MySQL, Presto, BigQuery 등)마다 지원 여부와 출력 포맷이 다릅니다. 실패 시 엔진별 문법(EXPLAIN ANALYZE, EXPLAIN FORMAT=JSON 등)으로 직접 실행해보세요.`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `EXPLAIN 실패: ${client.formatError(err)}\n\n데이터소스가 EXPLAIN을 지원하지 않거나 문법이 다를 수 있습니다.`,
        },
      ],
      isError: true,
    };
  }
}
