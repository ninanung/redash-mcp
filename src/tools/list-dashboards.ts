import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ListDashboardsArgs } from "@/interfaces/tool-args.js";

export async function handleListDashboards(
  args: ListDashboardsArgs,
  client: RedashClient
): Promise<ToolResult> {
  const result = await client.listDashboards({
    q: args.q,
    page: args.page,
    pageSize: args.page_size,
  });

  const lines = result.results.map((d) => {
    const tags = d.tags && d.tags.length > 0 ? ` [${d.tags.join(", ")}]` : "";
    return `#${d.id} (${d.slug}): ${d.name}${tags}`;
  });

  const header = `대시보드 ${result.results.length}건 (page ${result.page}, total ${result.count})`;
  const body = lines.length > 0 ? lines.join("\n") : "(결과 없음)";

  return { content: [{ type: "text", text: `${header}\n\n${body}` }] };
}
