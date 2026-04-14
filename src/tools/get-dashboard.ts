import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { GetDashboardArgs } from "@/interfaces/tool-args.js";

export async function handleGetDashboard(
  args: GetDashboardArgs,
  client: RedashClient
): Promise<ToolResult> {
  const d = await client.getDashboard(args.id);

  const widgets = d.widgets.map((w) => {
    if (w.visualization?.query) {
      const q = w.visualization.query;
      return {
        widget_id: w.id,
        visualization: w.visualization.name,
        viz_type: w.visualization.type,
        query_id: q.id,
        query_name: q.name,
        data_source_id: q.data_source_id,
      };
    }
    return {
      widget_id: w.id,
      text: w.text ?? null,
    };
  });

  const body = {
    id: d.id,
    slug: d.slug,
    name: d.name,
    tags: d.tags,
    updated_at: d.updated_at,
    widget_count: d.widgets.length,
    widgets,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
  };
}
