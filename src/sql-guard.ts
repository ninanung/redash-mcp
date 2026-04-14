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
    return { ok: false, reason: "빈 쿼리입니다." };
  }

  const withoutTrailingSemi = normalized.replace(/;+\s*$/, "");
  if (/;[\s\S]*\S/.test(withoutTrailingSemi)) {
    return { ok: false, reason: "세미콜론을 사용한 다중 문장은 허용되지 않습니다." };
  }

  const upper = withoutTrailingSemi.toUpperCase();
  if (!/^\s*(SELECT|WITH)\b/.test(upper)) {
    return { ok: false, reason: "SELECT/WITH 문만 실행할 수 있습니다." };
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      return {
        ok: false,
        reason: `금지된 키워드가 포함되어 있습니다: ${kw}`,
      };
    }
  }

  return { ok: true };
}
