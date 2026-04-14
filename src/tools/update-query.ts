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
          text: "업데이트할 필드(name/query/description/tags) 중 하나 이상을 지정해주세요.",
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
        text: `쿼리 #${updated.id} 업데이트 완료\nURL: ${url}\nname: ${updated.name}`,
      },
    ],
  };
}
