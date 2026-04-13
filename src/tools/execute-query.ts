import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExecuteQueryArgs } from "@/interfaces/tool-args.js";

export async function handleExecuteQuery(
  args: ExecuteQueryArgs,
  client: RedashClient
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

  const result = await client.executeAdhocQuery(query, dataSourceId);
  const data = result.query_result.data;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
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
        ),
      },
    ],
  };
}
