const OFF_VALUES = new Set(["off", "false", "0", "no"]);

/**
 * Whether tool responses append the presentation guidance for the LLM
 * ("IMPORTANT: include the executed SQL verbatim…", "To save this query, use
 * save_query…"). Disabled with REDASH_RESULT_HINTS=off for consumers whose
 * own prompts govern presentation or that block save_query.
 */
export function resultHintsEnabled(): boolean {
  const raw = (process.env.REDASH_RESULT_HINTS ?? "").trim().toLowerCase();
  return !OFF_VALUES.has(raw);
}

export const SQL_VERBATIM_HINT =
  "IMPORTANT: When presenting the result to the user, you MUST always include this executed SQL verbatim in a ```sql code block alongside the result. Do not omit or paraphrase it.";

export const SQL_VERBATIM_WITH_PARAMS_HINT =
  "IMPORTANT: When presenting the result to the user, you MUST always include this executed SQL verbatim in a ```sql code block alongside the result, and list the parameter values it ran with. Do not omit or paraphrase them.";

export const SAVE_QUERY_HINT =
  "To save this query to Redash, use the save_query tool (ask the user for confirmation and a name).";

/** Join hint paragraphs onto a body, or return the body unchanged when hints are off. */
export function withHints(body: string, ...hints: string[]): string {
  if (!resultHintsEnabled() || hints.length === 0) return body;
  return `${body}\n\n${hints.join("\n\n")}`;
}
