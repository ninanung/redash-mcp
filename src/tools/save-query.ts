import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { SaveQueryArgs } from "@/interfaces/tool-args.js";

export async function handleSaveQuery(
  args: SaveQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, name, query } = args;

  const saved = await client.saveQuery(name, query, dataSourceId);
  const url = `${process.env.REDASH_URL}/queries/${saved.id}`;

  return {
    content: [
      {
        type: "text",
        text: `쿼리 저장 완료!\nID: ${saved.id}\nURL: ${url}`,
      },
    ],
  };
}
