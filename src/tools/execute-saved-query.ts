import { RedashClient } from "@/redash-client.js";
import { getMaskedColumns, maskRow } from "@/masking.js";
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

  const columnNames = data.columns.map((c) => c.name);
  const maskedCols = getMaskedColumns(columnNames);
  let rows = data.rows.slice(0, maxRows);
  if (maskedCols.length > 0) {
    rows = rows.map((r) => maskRow(r, columnNames));
  }
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
    ? `\n\nNote: Returned the first ${maxRows} of ${data.rows.length} rows. Increase max_rows or rerun via execute_query with an adjusted LIMIT if you need more.`
    : "";

  return {
    content: [
      { type: "text", text: resultJson },
      {
        type: "text",
        text: `Executed saved query #${queryId} "${saved.name}":\n\`\`\`sql\n${saved.query}\n\`\`\`${notesText}\n\nIMPORTANT: When presenting the result to the user, you MUST always include this executed SQL verbatim in a \`\`\`sql code block alongside the result. Do not omit or paraphrase it.`,
      },
    ],
  };
}
