import { RedashClient } from "@/redash-client.js";
import { validateReadOnlySql } from "@/sql-guard.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExplainQueryArgs } from "@/interfaces/tool-args.js";

export async function handleExplainQuery(
  args: ExplainQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, query } = args;

  const guard = validateReadOnlySql(query);
  if (!guard.ok) {
    return {
      content: [{ type: "text", text: guard.reason ?? "Query rejected." }],
      isError: true,
    };
  }

  const stripped = query.trim().replace(/;+\s*$/, "");
  const explainSql = `EXPLAIN ${stripped}`;

  try {
    const result = await client.executeAdhocQuery(explainSql, dataSourceId);
    const data = result.query_result.data;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              columns: data.columns.map((c) => ({ name: c.name, type: c.type })),
              rows: data.rows,
              runtime: result.query_result.runtime,
            },
            null,
            2
          ),
        },
        {
          type: "text",
          text: `Executed SQL:\n\`\`\`sql\n${explainSql}\n\`\`\`\n\nIMPORTANT: When presenting the result to the user, you MUST always include this executed SQL verbatim in a \`\`\`sql code block alongside the result. Do not omit or paraphrase it.\n\nNote: EXPLAIN support and output format vary by engine (PostgreSQL, MySQL, Presto, BigQuery, etc.). If it fails, run engine-specific syntax directly (e.g. EXPLAIN ANALYZE, EXPLAIN FORMAT=JSON).`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `EXPLAIN failed: ${client.formatError(err)}\n\nThe data source may not support EXPLAIN or may use different syntax.`,
        },
      ],
      isError: true,
    };
  }
}
