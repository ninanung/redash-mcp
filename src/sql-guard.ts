const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "MERGE",
  "REPLACE",
  "GRANT",
  "REVOKE",
  "CALL",
  "EXEC",
  "EXECUTE",
];

function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'([^'\\]|\\.|'')*'/g, "''")
    .replace(/"([^"\\]|\\.|"")*"/g, '""');
}

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

export function validateReadOnlySql(sql: string): GuardResult {
  const normalized = stripCommentsAndStrings(sql).trim();
  if (normalized.length === 0) {
    return { ok: false, reason: "Empty query." };
  }

  const withoutTrailingSemi = normalized.replace(/;+\s*$/, "");
  if (/;[\s\S]*\S/.test(withoutTrailingSemi)) {
    return { ok: false, reason: "Multiple statements separated by semicolons are not allowed." };
  }

  const upper = withoutTrailingSemi.toUpperCase();
  if (!/^\s*(SELECT|WITH)\b/.test(upper)) {
    return { ok: false, reason: "Only SELECT/WITH statements are allowed." };
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      return {
        ok: false,
        reason: `Forbidden keyword detected: ${kw}`,
      };
    }
  }

  return { ok: true };
}
