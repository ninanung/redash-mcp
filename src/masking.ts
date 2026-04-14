const BUILTIN_PATTERNS = [
  /email/i,
  /phone/i,
  /mobile/i,
  /^tel$|_tel$/i,
  /ssn/i,
  /resident/i,
  /rrn/i,
  /password|passwd|^pwd$/i,
  /token/i,
  /api_key|secret/i,
  /card_?(number|no)|credit_?card/i,
];

function loadUserPatterns(): RegExp[] {
  const raw = process.env.REDASH_MASK_COLUMNS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== "builtin")
    .map((s) => {
      // 와일드카드 *는 정규식 .*로, 그 외는 부분 일치
      const escaped = s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(escaped, "i");
    });
}

function builtinEnabled(): boolean {
  const raw = process.env.REDASH_MASK_COLUMNS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes("builtin");
}

let cachedPatterns: RegExp[] | null = null;

function getPatterns(): RegExp[] {
  if (cachedPatterns !== null) return cachedPatterns;
  const user = loadUserPatterns();
  const patterns = builtinEnabled() ? [...user, ...BUILTIN_PATTERNS] : user;
  cachedPatterns = patterns;
  return patterns;
}

export function isMasked(columnName: string): boolean {
  const patterns = getPatterns();
  if (patterns.length === 0) return false;
  return patterns.some((p) => p.test(columnName));
}

export function maskValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.length === 0) return "";
  if (str.length <= 2) return "*".repeat(str.length);
  if (str.length <= 4) return str[0] + "*".repeat(str.length - 1);
  return str[0] + "*".repeat(str.length - 2) + str[str.length - 1];
}

export function maskRow(
  row: Record<string, unknown>,
  columns: string[]
): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...row };
  for (const col of columns) {
    if (isMasked(col)) {
      masked[col] = maskValue(row[col]);
    }
  }
  return masked;
}

export function getMaskedColumns(columnNames: string[]): string[] {
  return columnNames.filter((c) => isMasked(c));
}
