import { RedashClient } from "@/redash-client.js";
import {
  formatLastModified,
  formatParameterLines,
} from "@/query-parameters.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { GetSavedQueryArgs } from "@/interfaces/tool-args.js";

export async function handleGetSavedQuery(
  args: GetSavedQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const q = await client.getSavedQuery(args.query_id);
  const parameterLines = formatParameterLines(q);

  const meta = [
    `#${q.id}: ${q.name}`,
    `data_source_id: ${q.data_source_id}`,
    q.description ? `description: ${q.description}` : null,
    q.tags && q.tags.length > 0 ? `tags: ${q.tags.join(", ")}` : null,
    formatLastModified(q),
    ...parameterLines,
  ]
    .filter(Boolean)
    .join("\n");

  const parameterNote =
    parameterLines.length > 0
      ? "\n\nNote: execute_saved_query uses the stored default for any parameter you do not pass. Pass parameters explicitly when the default is not what the user wants."
      : "";

  return {
    content: [
      {
        type: "text",
        text: `${meta}\n\n\`\`\`sql\n${q.query}\n\`\`\`${parameterNote}`,
      },
    ],
  };
}
