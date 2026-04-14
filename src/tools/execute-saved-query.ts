import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExecuteSavedQueryArgs } from "@/interfaces/tool-args.js";

const DEFAULT_MAX_ROWS = 1000;

export async function handleExecuteSavedQuery(
  args: ExecuteSavedQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const { query_id: queryId, parameters = {}, max_rows: maxRowsArg } = args;
  const maxRows = maxRowsArg ?? DEFAULT_MAX_ROWS;

  const saved = await client.getSavedQuery(queryId);
  const result = await client.executeSavedQuery(queryId, parameters);
  const data = result.query_result.data;

  const rows = data.rows.slice(0, maxRows);
  const truncated = data.rows.length > maxRows;

  const resultJson = JSON.stringify(
    {
      query_id: queryId,
      name: saved.name,
      columns: data.columns.map((c) => ({ name: c.name, type: c.type })),
      rows,
      row_count: rows.length,
      total_rows: data.rows.length,
      runtime: result.query_result.runtime,
    },
    null,
    2
  );

  const notesText = truncated
    ? `\n\n주의: 전체 ${data.rows.length}행 중 앞 ${maxRows}행만 반환했습니다. max_rows를 늘리거나 필요한 경우 execute_query로 LIMIT을 조정해 다시 실행하세요.`
    : "";

  return {
    content: [
      { type: "text", text: resultJson },
      {
        type: "text",
        text: `실행된 저장 쿼리 #${queryId} "${saved.name}":\n\`\`\`sql\n${saved.query}\n\`\`\`${notesText}`,
      },
    ],
  };
}
