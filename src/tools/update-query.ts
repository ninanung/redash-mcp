import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { UpdateQueryArgs } from "@/interfaces/tool-args.js";

export async function handleUpdateQuery(
  args: UpdateQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const { query_id: queryId, name, query, description, tags } = args;

  if (
    name === undefined &&
    query === undefined &&
    description === undefined &&
    tags === undefined
  ) {
    return {
      content: [
        {
          type: "text",
          text: "Specify at least one field to update (name/query/description/tags).",
        },
      ],
      isError: true,
    };
  }

  const updated = await client.updateQuery(queryId, {
    name,
    query,
    description,
    tags,
  });
  const url = `${process.env.REDASH_URL}/queries/${updated.id}`;

  return {
    content: [
      {
        type: "text",
        text: `Query #${updated.id} updated\nURL: ${url}\nname: ${updated.name}`,
      },
    ],
  };
}
