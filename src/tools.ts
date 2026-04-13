import { z } from "zod";
import { RedashClient } from "./redash-client.js";
import { SchemaCache } from "./schema-cache.js";
import { MetadataCache } from "./metadata-cache.js";

// JSON Schema 타입 정의
interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
  description?: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "list_data_sources",
      description: "Redash 데이터소스 목록을 조회합니다.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_schema",
      description:
        "데이터소스의 테이블/컬럼 스키마를 조회합니다. 캐싱되어 반복 조회 시 빠릅니다. keywords로 테이블을 필터링할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "데이터소스 ID",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description:
              "테이블명 필터링 키워드 (예: ['order', 'user'])",
          },
          refresh: {
            type: "boolean",
            description: "true면 캐시를 무시하고 새로 조회",
          },
        },
        required: ["data_source_id"],
      },
    },
    {
      name: "execute_query",
      description:
        "SQL을 실행하고 결과를 반환합니다. 비동기 job 폴링을 내부에서 처리합니다.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "데이터소스 ID",
          },
          query: {
            type: "string",
            description: "실행할 SQL (SELECT만 허용)",
          },
        },
        required: ["data_source_id", "query"],
      },
    },
    {
      name: "explore_column",
      description:
        "컬럼의 고유값(DISTINCT)과 건수를 조회합니다. WHERE 절 작성 전 컬럼 타입과 값을 확인하는 데 사용합니다. 여러 컬럼을 한번에 탐색할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "데이터소스 ID",
          },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "테이블명 (schema.table 형식)",
                },
                column: { type: "string", description: "컬럼명" },
                partition_filter: {
                  type: "string",
                  description:
                    "파티션 필터 (예: p_ymd = '20260413'). 대용량 테이블 필수.",
                },
              },
              required: ["table", "column"],
            },
            description: "탐색할 컬럼 목록",
          },
          limit: {
            type: "number",
            description: "각 컬럼별 고유값 최대 개수 (기본 20)",
          },
        },
        required: ["data_source_id", "columns"],
      },
    },
    {
      name: "find_mapping",
      description:
        "숫자 코드 컬럼의 매핑 테이블을 자동 탐색하고 조회합니다. 코드값이 어떤 상태를 의미하는지 확인할 때 사용합니다.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "데이터소스 ID",
          },
          table: {
            type: "string",
            description:
              "코드 컬럼이 있는 원본 테이블명 (예: bh_idusme.order_total)",
          },
          column: {
            type: "string",
            description: "코드 컬럼명 (예: lastest_state)",
          },
        },
        required: ["data_source_id", "table", "column"],
      },
    },
    {
      name: "save_query",
      description: "실행한 SQL을 Redash에 저장합니다.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "데이터소스 ID",
          },
          name: { type: "string", description: "쿼리 이름" },
          query: { type: "string", description: "저장할 SQL" },
        },
        required: ["data_source_id", "name", "query"],
      },
    },
    {
      name: "get_cache",
      description:
        "저장된 메타데이터 캐시를 조회합니다. 컬럼 타입/값, 매핑 테이블, 추천 테이블 정보를 확인할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description:
              "검색 키워드 (예: 'membership', 'order_total.lastest_state'). 없으면 전체 요약.",
          },
        },
      },
    },
  ];
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: RedashClient,
  schemaCache: SchemaCache,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  switch (name) {
    case "list_data_sources":
      return handleListDataSources(client);
    case "get_schema":
      return handleGetSchema(args, client, schemaCache, metadataCache);
    case "execute_query":
      return handleExecuteQuery(args, client);
    case "explore_column":
      return handleExploreColumn(args, client, metadataCache);
    case "find_mapping":
      return handleFindMapping(args, client, schemaCache, metadataCache);
    case "save_query":
      return handleSaveQuery(args, client);
    case "get_cache":
      return handleGetCache(args, metadataCache);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// --- Handler implementations ---

async function handleListDataSources(
  client: RedashClient
): Promise<ToolResult> {
  const sources = await client.listDataSources();
  const list = sources
    .map((s) => `${s.id}: ${s.name} (${s.type})`)
    .join("\n");
  return { content: [{ type: "text", text: list }] };
}

async function handleGetSchema(
  args: Record<string, unknown>,
  client: RedashClient,
  schemaCache: SchemaCache,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const dataSourceId = args.data_source_id as number;
  const keywords = args.keywords as string[] | undefined;
  const refresh = args.refresh as boolean | undefined;

  // 키워드가 있으면 테이블 추천 캐시 확인
  const recommendations: string[] = [];
  if (keywords && keywords.length > 0 && !refresh) {
    for (const kw of keywords) {
      const rec = metadataCache.getTableRecommendation(kw);
      if (rec) {
        const avoidInfo = rec.avoid
          ? Object.entries(rec.avoid)
              .map(([t, reason]) => `  ⚠ ${t}: ${reason}`)
              .join("\n")
          : "";
        recommendations.push(
          `[캐시 추천] "${kw}" → ${rec.recommended} (${rec.reason})${avoidInfo ? "\n" + avoidInfo : ""}`
        );
      }
    }
  }

  const tables = await schemaCache.getSchema(client, dataSourceId, refresh);

  let filtered = tables;
  if (keywords && keywords.length > 0) {
    filtered = schemaCache.filterTables(tables, keywords);
  }

  if (filtered.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `매칭되는 테이블이 없습니다. 전체 ${tables.length}개 테이블 중 키워드와 일치하는 항목 없음.`,
        },
      ],
    };
  }

  const recPrefix =
    recommendations.length > 0
      ? recommendations.join("\n") + "\n\n"
      : "";

  // 테이블이 100개 초과면 이름만 반환
  if (filtered.length > 100) {
    const names = schemaCache.getTableNames(filtered);
    return {
      content: [
        {
          type: "text",
          text: `${recPrefix}${filtered.length}개 테이블 (이름만 표시):\n${names.join("\n")}`,
        },
      ],
    };
  }

  const output = filtered
    .map((t) => `${t.name}: ${t.columns.join(", ")}`)
    .join("\n");

  const cached = schemaCache.isCached(dataSourceId);
  const prefix = cached && !refresh ? "[캐시됨] " : "[새로 조회] ";

  return {
    content: [
      {
        type: "text",
        text: `${recPrefix}${prefix}${filtered.length}개 테이블:\n${output}`,
      },
    ],
  };
}

async function handleExecuteQuery(
  args: Record<string, unknown>,
  client: RedashClient
): Promise<ToolResult> {
  const query = args.query as string;
  const dataSourceId = args.data_source_id as number;

  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    return {
      content: [
        { type: "text", text: "SELECT/WITH 문만 실행할 수 있습니다." },
      ],
      isError: true,
    };
  }

  const result = await client.executeAdhocQuery(query, dataSourceId);
  const data = result.query_result.data;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            columns: data.columns.map((c) => ({
              name: c.name,
              type: c.type,
            })),
            rows: data.rows,
            row_count: data.rows.length,
            runtime: result.query_result.runtime,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleExploreColumn(
  args: Record<string, unknown>,
  client: RedashClient,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const dataSourceId = args.data_source_id as number;
  const columns = args.columns as {
    table: string;
    column: string;
    partition_filter?: string;
  }[];
  const limit = (args.limit as number) ?? 20;
  const refresh = (args as Record<string, unknown>).refresh as boolean | undefined;

  // 캐시 확인: refresh가 아니면 캐시된 컬럼은 스킵
  const cached: string[] = [];
  const toQuery: typeof columns = [];

  for (const c of columns) {
    const key = `${c.table}.${c.column}`;
    const hit = !refresh ? metadataCache.getColumn(key) : null;
    if (hit) {
      cached.push(key);
    } else {
      toQuery.push(c);
    }
  }

  // 캐시된 결과 먼저 출력 준비
  const output: string[] = [];

  for (const key of cached) {
    const info = metadataCache.getColumn(key)!;
    const typeHint =
      info.type === "integer"
        ? "integer (숫자 리터럴로 비교)"
        : "varchar (문자열로 비교)";
    output.push(`\n[${key}] [캐시됨] (추정 타입: ${typeHint})`);
    for (const v of info.values) {
      output.push(`  ${v.val} : ${v.cnt.toLocaleString()}건`);
    }
  }

  // 캐시 미스된 컬럼만 실제 조회
  if (toQuery.length > 0) {
    const parts = toQuery.map((c) => {
      const where = c.partition_filter ? `WHERE ${c.partition_filter}` : "";
      return `SELECT '${c.table}.${c.column}' AS col, CAST(${c.column} AS varchar) AS val, COUNT(*) AS cnt FROM ${c.table} ${where} GROUP BY CAST(${c.column} AS varchar) ORDER BY cnt DESC LIMIT ${limit}`;
    });

    const sql = parts.join("\nUNION ALL\n");
    const result = await client.executeAdhocQuery(sql, dataSourceId);
    const rows = result.query_result.data.rows;

    // 컬럼별 그룹핑
    const grouped = new Map<string, { val: string; cnt: number }[]>();
    for (const row of rows) {
      const col = row.col as string;
      if (!grouped.has(col)) grouped.set(col, []);
      grouped.get(col)!.push({
        val: row.val as string,
        cnt: row.cnt as number,
      });
    }

    // 타입 추정, 출력, 캐시 저장
    for (const [col, values] of grouped) {
      const allNumeric = values.every((v) => /^\d+$/.test(v.val));
      const colType = allNumeric ? "integer" : "varchar";
      const typeHint = allNumeric
        ? "integer (숫자 리터럴로 비교)"
        : "varchar (문자열로 비교)";

      output.push(`\n[${col}] [새로 조회] (추정 타입: ${typeHint})`);
      for (const v of values) {
        output.push(`  ${v.val} : ${v.cnt.toLocaleString()}건`);
      }

      // 캐시 저장
      metadataCache.setColumn(col, {
        type: colType,
        values,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    }
  }

  return { content: [{ type: "text", text: output.join("\n") }] };
}

async function handleFindMapping(
  args: Record<string, unknown>,
  client: RedashClient,
  schemaCache: SchemaCache,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const dataSourceId = args.data_source_id as number;
  const table = args.table as string;
  const column = args.column as string;
  const refresh = (args as Record<string, unknown>).refresh as boolean | undefined;

  const cacheKey = `${table}.${column}`;

  // 캐시 확인
  if (!refresh) {
    const hit = metadataCache.getMapping(cacheKey);
    if (hit) {
      const header = Object.keys(hit.entries[0] ?? {}).join(" | ");
      const rows = hit.entries.map((r) => Object.values(r).join(" | "));
      return {
        content: [
          {
            type: "text",
            text: `[캐시됨] 매핑 테이블: ${hit.mappingTable}\n\n${header}\n${"─".repeat(header.length)}\n${rows.join("\n")}`,
          },
        ],
      };
    }
  }

  const tables = await schemaCache.getSchema(client, dataSourceId);

  // 테이블명에서 schema 부분 제거
  const shortTable = table.includes(".")
    ? table.split(".").pop()!
    : table;

  // 1순위: _mapping 패턴
  const patterns = [
    `${shortTable}_${column}_mapping`,
    `${shortTable}_${column}`,
    `${column}_mapping`,
    `${column}_master`,
    `${column}_code`,
  ];

  const candidates: string[] = [];
  for (const pattern of patterns) {
    for (const t of tables) {
      if (t.name.toLowerCase().endsWith(pattern)) {
        candidates.push(t.name);
      }
    }
  }

  // 2순위: 컬럼 2~4개 + 관련 키워드
  if (candidates.length === 0) {
    for (const t of tables) {
      const name = t.name.toLowerCase();
      const cols = t.columns.length;
      if (
        cols >= 2 &&
        cols <= 4 &&
        (name.includes(column) || name.includes(shortTable)) &&
        (name.includes("mapping") ||
          name.includes("master") ||
          name.includes("code") ||
          name.includes("type") ||
          name.includes("enum"))
      ) {
        candidates.push(t.name);
      }
    }
  }

  // 3순위: 못 찾음
  if (candidates.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `매핑 테이블을 찾지 못했습니다.\n탐색 패턴: ${patterns.join(", ")}\n사용자에게 코드값의 의미를 직접 확인하세요.`,
        },
      ],
    };
  }

  // 첫 번째 후보 조회
  const mappingTable = candidates[0];
  const sql = `SELECT * FROM ${mappingTable} ORDER BY 1 LIMIT 50`;

  const result = await client.executeAdhocQuery(sql, dataSourceId);
  const data = result.query_result.data;

  const header = data.columns.map((c) => c.name).join(" | ");
  const rows = data.rows.map((r) =>
    data.columns.map((c) => String(r[c.name] ?? "")).join(" | ")
  );

  // 캐시 저장
  const entries = data.rows.map((r) => {
    const entry: Record<string, string> = {};
    for (const c of data.columns) {
      entry[c.name] = String(r[c.name] ?? "");
    }
    return entry;
  });

  metadataCache.setMapping(cacheKey, {
    mappingTable,
    entries,
    updatedAt: new Date().toISOString().slice(0, 10),
  });

  return {
    content: [
      {
        type: "text",
        text: `[새로 조회] 매핑 테이블: ${mappingTable}\n${candidates.length > 1 ? `(다른 후보: ${candidates.slice(1).join(", ")})\n` : ""}\n${header}\n${"─".repeat(header.length)}\n${rows.join("\n")}`,
      },
    ],
  };
}

async function handleSaveQuery(
  args: Record<string, unknown>,
  client: RedashClient
): Promise<ToolResult> {
  const dataSourceId = args.data_source_id as number;
  const name = args.name as string;
  const query = args.query as string;

  const saved = await client.saveQuery(name, query, dataSourceId);
  const url = `${process.env.REDASH_URL}/queries/${saved.id}`;

  return {
    content: [
      {
        type: "text",
        text: `쿼리 저장 완료!\nID: ${saved.id}\nURL: ${url}`,
      },
    ],
  };
}

async function handleGetCache(
  args: Record<string, unknown>,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const keyword = args.keyword as string | undefined;

  if (!keyword) {
    return {
      content: [{ type: "text", text: metadataCache.getSummary() }],
    };
  }

  const output: string[] = [];

  // 컬럼 캐시 검색
  const columns = metadataCache.searchColumns(keyword);
  if (Object.keys(columns).length > 0) {
    output.push("## 컬럼 정보");
    for (const [key, info] of Object.entries(columns)) {
      const typeHint =
        info.type === "integer"
          ? "integer (숫자 리터럴로 비교)"
          : "varchar (문자열로 비교)";
      output.push(`\n[${key}] (${typeHint}) — ${info.updatedAt}`);
      for (const v of info.values) {
        output.push(`  ${v.val} : ${v.cnt.toLocaleString()}건`);
      }
    }
  }

  // 매핑 캐시 검색
  const mappings = metadataCache.searchMappings(keyword);
  if (Object.keys(mappings).length > 0) {
    output.push("\n## 매핑 정보");
    for (const [key, info] of Object.entries(mappings)) {
      const header = Object.keys(info.entries[0] ?? {}).join(" | ");
      const rows = info.entries.map((r) => Object.values(r).join(" | "));
      output.push(`\n[${key}] → ${info.mappingTable} — ${info.updatedAt}`);
      output.push(header);
      output.push("─".repeat(header.length));
      output.push(rows.join("\n"));
    }
  }

  // 테이블 추천 검색
  const recs = metadataCache.searchTableRecommendations(keyword);
  if (Object.keys(recs).length > 0) {
    output.push("\n## 테이블 추천");
    for (const [key, rec] of Object.entries(recs)) {
      output.push(
        `\n"${key}" → ${rec.recommended} (${rec.reason}) — ${rec.updatedAt}`
      );
      if (rec.avoid) {
        for (const [t, reason] of Object.entries(rec.avoid)) {
          output.push(`  ⚠ 비추천: ${t} — ${reason}`);
        }
      }
    }
  }

  if (output.filter((l) => l.trim()).length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `"${keyword}"와 일치하는 캐시가 없습니다.\n${metadataCache.getSummary()}`,
        },
      ],
    };
  }

  return { content: [{ type: "text", text: output.join("\n") }] };
}
