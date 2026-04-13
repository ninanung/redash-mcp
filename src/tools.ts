import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import { MetadataCache } from "@/metadata-cache.js";
import type { ToolDefinition, ToolResult } from "@/interfaces/tools.js";
import type {
  GetSchemaArgs,
  ExecuteQueryArgs,
  ExploreColumnArgs,
  FindMappingArgs,
  SaveQueryArgs,
  GetCacheArgs,
} from "@/interfaces/tool-args.js";
import { handleListDataSources } from "@/tools/list-data-sources.js";
import { handleGetSchema } from "@/tools/get-schema.js";
import { handleExecuteQuery } from "@/tools/execute-query.js";
import { handleExploreColumn } from "@/tools/explore-column.js";
import { handleFindMapping } from "@/tools/find-mapping.js";
import { handleSaveQuery } from "@/tools/save-query.js";
import { handleGetCache } from "@/tools/get-cache.js";

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
      return handleGetSchema(args as GetSchemaArgs, client, schemaCache, metadataCache);
    case "execute_query":
      return handleExecuteQuery(args as ExecuteQueryArgs, client);
    case "explore_column":
      return handleExploreColumn(args as ExploreColumnArgs, client, metadataCache);
    case "find_mapping":
      return handleFindMapping(args as FindMappingArgs, client, schemaCache, metadataCache);
    case "save_query":
      return handleSaveQuery(args as SaveQueryArgs, client);
    case "get_cache":
      return handleGetCache(args as GetCacheArgs, metadataCache);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
