import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";

export async function handleListDataSources(
  client: RedashClient
): Promise<ToolResult> {
  const sources = await client.listDataSources();
  const list = sources
    .map((s) => `${s.id}: ${s.name} (${s.type})`)
    .join("\n");
  return { content: [{ type: "text", text: list }] };
}
