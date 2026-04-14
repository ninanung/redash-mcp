import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { SaveQueryArgs } from "@/interfaces/tool-args.js";

export async function handleSaveQuery(
  args: SaveQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const {
    data_source_id: dataSourceId,
    name,
    query,
    description,
    tags,
  } = args;

  const saved = await client.saveQuery(name, query, dataSourceId, {
    description,
    tags,
  });
  const url = `${process.env.REDASH_URL}/queries/${saved.id}`;

  const lines = [`Query saved!`, `ID: ${saved.id}`, `URL: ${url}`];
  if (description) lines.push(`description: ${description}`);
  if (tags && tags.length > 0) lines.push(`tags: ${tags.join(", ")}`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
