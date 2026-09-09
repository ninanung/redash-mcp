import { RedashClient } from "@/redash-client.js";
import { getMaskedColumns, maskRow } from "@/masking.js";
import {
  formatEffectiveParameters,
  getSavedParameters,
  normalizeParameters,
  resolveEffectiveParameters,
} from "@/query-parameters.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExecuteSavedQueryArgs } from "@/interfaces/tool-args.js";
import { defaultMaxRows, formatResult, resolveFormat } from "@/result-format.js";

export async function handleExecuteSavedQuery(
  args: ExecuteSavedQueryArgs,
  client: RedashClient
): Promise<ToolResult> {
  const {
    query_id: queryId,
    parameters: rawParameters = {},
    max_rows: maxRowsArg,
    format: formatArg,
  } = args;
  const maxRows = maxRowsArg ?? defaultMaxRows();
  const format = resolveFormat(formatArg);

  const saved = await client.getSavedQuery(queryId);
  const declaredNames = getSavedParameters(saved).map((p) => p.name);
  const { parameters, renamed, unknown } = normalizeParameters(saved, rawParameters);

  if (unknown.length > 0) {
    const accepted =
      declaredNames.length > 0 ? declaredNames.join(", ") : "(none declared)";
    return {
      content: [
        {
          type: "text",
          text: `Unknown parameter(s) for saved query #${queryId}: ${unknown.join(", ")}.\nThis query accepts: ${accepted}.\nUse the bare parameter name (no "p_" URL prefix). Call get_saved_query to see each parameter's type and stored default.`,
        },
      ],
      isError: true,
    };
  }

  const effectiveParameters = resolveEffectiveParameters(saved, parameters);

  let result;
  try {
    result = await client.executeSavedQuery(queryId, parameters);
  } catch (error) {
    const sent = formatEffectiveParameters(effectiveParameters);
    return {
      content: [
        {
          type: "text",
          text: `Saved query #${queryId} "${saved.name}" failed: ${client.formatError(error)}${sent ? `\n\n${sent}` : ""}`,
        },
      ],
      isError: true,
    };
  }
  const data = result.query_result.data;

  const columnNames = data.columns.map((c) => c.name);
  const maskedCols = getMaskedColumns(columnNames);
  let rows = data.rows.slice(0, maxRows);
  if (maskedCols.length > 0) {
    rows = rows.map((r) => maskRow(r, columnNames));
  }
  const truncated = data.rows.length > maxRows;

  const resultJson = formatResult(format, data.columns, rows, {
    query_id: queryId,
    name: saved.name,
    parameters: Object.fromEntries(
      effectiveParameters.map((p) => [p.name, p.value])
    ),
    row_count: rows.length,
    total_rows: data.rows.length,
    runtime: result.query_result.runtime,
  });

  const parametersText = formatEffectiveParameters(effectiveParameters);
  const renamedText =
    renamed.length > 0
      ? `\nNote: renamed ${renamed.map((r) => `${r.from} -> ${r.to}`).join(", ")} (Redash API uses bare parameter names without the "p_" URL prefix).`
      : "";
  const parametersBlock = parametersText ? `\n\n${parametersText}${renamedText}` : "";

  const notesText = truncated
    ? `\n\nNote: Returned the first ${maxRows} of ${data.rows.length} rows. Increase max_rows or rerun via execute_query with an adjusted LIMIT if you need more.`
    : "";

  return {
    content: [
      { type: "text", text: resultJson },
      {
        type: "text",
        text: `Executed saved query #${queryId} "${saved.name}":\n\`\`\`sql\n${saved.query}\n\`\`\`${parametersBlock}${notesText}\n\nIMPORTANT: When presenting the result to the user, you MUST always include this executed SQL verbatim in a \`\`\`sql code block alongside the result, and list the parameter values it ran with. Do not omit or paraphrase them.`,
      },
    ],
  };
}
