import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { GetSavedQueryArgs } from "@/interfaces/tool-args.js";

export async function handleGetSavedQuery(
  args: GetSavedQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const q = await client.getSavedQuery(args.query_id);

  const meta = [
    `#${q.id}: ${q.name}`,
    `data_source_id: ${q.data_source_id}`,
    q.description ? `description: ${q.description}` : null,
    q.tags && q.tags.length > 0 ? `tags: ${q.tags.join(", ")}` : null,
    q.updated_at ? `updated_at: ${q.updated_at}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `${meta}\n\n\`\`\`sql\n${q.query}\n\`\`\``,
      },
    ],
  };
}
