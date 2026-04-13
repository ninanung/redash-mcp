import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";

export async function handleSaveQuery(
  args: Record<string, unknown>,
  client: RedashClient
): Promise<ToolResult> {
  const dataSourceId = args.data_source_id as number;
  const name = args.name as string;
  const query = args.query as string;

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
