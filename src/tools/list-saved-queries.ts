import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ListSavedQueriesArgs } from "@/interfaces/tool-args.js";

export async function handleListSavedQueries(
  args: ListSavedQueriesArgs,
  client: RedashClient
): Promise<ToolResult> {
  const result = await client.listSavedQueries({
    q: args.q,
    dataSourceId: args.data_source_id,
    page: args.page,
    pageSize: args.page_size,
  });

  const lines = result.results.map((q) => {
    const tags = q.tags && q.tags.length > 0 ? ` [${q.tags.join(", ")}]` : "";
    return `#${q.id} (ds=${q.data_source_id}): ${q.name}${tags}`;
  });

  const header = `저장된 쿼리 ${result.results.length}건 (page ${result.page}, total ${result.count})`;
  const body = lines.length > 0 ? lines.join("\n") : "(결과 없음)";

  return {
    content: [{ type: "text", text: `${header}\n\n${body}` }],
  };
}
