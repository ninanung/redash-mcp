import type {
  RedashQueryParameter,
  RedashSavedQuery,
} from "@/interfaces/redash-client.js";
import type { ResolvedParameter } from "@/interfaces/query-parameters.js";
export type {
  ParameterValueSource,
  ResolvedParameter,
} from "@/interfaces/query-parameters.js";

export function getSavedParameters(
  saved: RedashSavedQuery
): RedashQueryParameter[] {
  return saved.options?.parameters ?? [];
}

export function formatParameterValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "(none)";
  if (Array.isArray(value)) {
    return value.length === 0 ? "(none)" : value.map(String).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function describeParameter(p: RedashQueryParameter): string {
  const parts = [`${p.name} (${p.type ?? "unknown"})`];
  if (p.title && p.title !== p.name) parts.push(`title: ${p.title}`);
  parts.push(`default: ${formatParameterValue(p.value)}`);
  if (p.type === "enum" && p.enumOptions) {
    const options = p.enumOptions
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    if (options.length > 0) parts.push(`options: ${options.join(" | ")}`);
  }
  if (p.type === "query" && p.queryId !== undefined) {
    parts.push(`options from query #${p.queryId}`);
  }
  if (p.multiValuesOptions) parts.push("multi-value");
  return parts.join(" · ");
}

/** Lines describing stored parameters, or an empty array when the query has none. */
export function formatParameterLines(saved: RedashSavedQuery): string[] {
  const params = getSavedParameters(saved);
  if (params.length === 0) return [];
  return ["parameters:", ...params.map((p) => `  - ${describeParameter(p)}`)];
}

export function formatLastModified(saved: RedashSavedQuery): string | null {
  const author = saved.last_modified_by?.name ?? saved.user?.name;
  if (!saved.updated_at && !author) return null;
  const when = saved.updated_at ?? "unknown time";
  return author ? `last_modified: ${when} by ${author}` : `updated_at: ${when}`;
}

/**
 * Merge passed parameters with stored defaults, the same way Redash does
 * server-side: a passed value wins, otherwise the stored default is used.
 * Passed keys that the saved query does not declare are kept so the caller
 * can see they were sent.
 */
export function resolveEffectiveParameters(
  saved: RedashSavedQuery,
  passed: Record<string, unknown>
): ResolvedParameter[] {
  const resolved: ResolvedParameter[] = [];
  const declared = new Set<string>();
  for (const p of getSavedParameters(saved)) {
    declared.add(p.name);
    if (p.name in passed) {
      resolved.push({ name: p.name, value: passed[p.name], source: "passed" });
    } else {
      resolved.push({ name: p.name, value: p.value, source: "default" });
    }
  }
  for (const [name, value] of Object.entries(passed)) {
    if (!declared.has(name)) resolved.push({ name, value, source: "passed" });
  }
  return resolved;
}

export interface NormalizedParameters {
  parameters: Record<string, unknown>;
  /** Keys that were renamed, e.g. "p_user_id" -> "user_id". */
  renamed: Array<{ from: string; to: string }>;
  /** Passed keys the saved query does not declare. */
  unknown: string[];
}

/**
 * Map passed parameter names onto the names the saved query declares.
 * Redash URLs use a "p_" prefix (?p_user_id=1) while the API expects the bare
 * name, so a "p_" key is stripped when the bare name is declared. Validation is
 * skipped when the query declares no parameters at all (older queries saved via
 * the API can still use {{ placeholders }} without an options.parameters list).
 */
export function normalizeParameters(
  saved: RedashSavedQuery,
  passed: Record<string, unknown>
): NormalizedParameters {
  const declared = new Set(getSavedParameters(saved).map((p) => p.name));
  const parameters: Record<string, unknown> = {};
  const renamed: NormalizedParameters["renamed"] = [];
  const unknown: string[] = [];

  for (const [key, value] of Object.entries(passed)) {
    if (declared.size === 0 || declared.has(key)) {
      parameters[key] = value;
      continue;
    }
    const stripped = key.startsWith("p_") ? key.slice(2) : key;
    if (stripped !== key && declared.has(stripped)) {
      parameters[stripped] = value;
      renamed.push({ from: key, to: stripped });
      continue;
    }
    parameters[key] = value;
    unknown.push(key);
  }
  return { parameters, renamed, unknown };
}

export function formatEffectiveParameters(
  resolved: ResolvedParameter[]
): string | null {
  if (resolved.length === 0) return null;
  const lines = resolved.map(
    (r) =>
      `  - ${r.name} = ${formatParameterValue(r.value)}${
        r.source === "default" ? " (stored default)" : ""
      }`
  );
  return ["Parameters used:", ...lines].join("\n");
}
