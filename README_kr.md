# redash-mcp

[![npm version](https://img.shields.io/npm/v/@seungje.jun/redash-mcp.svg)](https://www.npmjs.com/package/@seungje.jun/redash-mcp)
[![license](https://img.shields.io/npm/l/@seungje.jun/redash-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@seungje.jun/redash-mcp.svg)](https://nodejs.org)

Redash API를 MCP(Model Context Protocol) 서버로 제공합니다. 스키마·컬럼 값·코드 매핑 정보를 캐싱(스키마는 인메모리, 메타데이터는 디스크 영구 저장)하여 반복 조회 시 Redash 호출을 생략하고, 모델이 매번 DB를 다시 탐색하지 않고도 쿼리를 구성할 수 있게 해줍니다.

[English README](./README.md)

## 설치 및 설정

### npx (설치 불필요)

`~/.mcp.json`에 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "redash": {
      "command": "npx",
      "args": ["@seungje.jun/redash-mcp"],
      "env": {
        "REDASH_URL": "https://redash.example.com",
        "REDASH_API_KEY": "your-key"
      }
    }
  }
}
```

### 소스에서 직접 빌드

```bash
git clone https://github.com/ninanung/redash-mcp.git
cd redash-mcp
npm install
npm run build
```

`~/.mcp.json`에 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "redash": {
      "command": "node",
      "args": ["/path/to/redash-mcp/dist/cli.js"],
      "env": {
        "REDASH_URL": "https://redash.example.com",
        "REDASH_API_KEY": "your-key"
      }
    }
  }
}
```

설정 후 Claude Code를 재시작하면 MCP 도구들이 활성화됩니다.

### 환경변수

| 변수 | 설명 |
|------|------|
| `REDASH_URL` | Redash 서버 URL |
| `REDASH_API_KEY` | Redash API Key |
| `REDASH_ALLOWED_DS` | (선택) 허용할 데이터소스 ID 목록 (콤마 구분, 예: `1,3,7`). 설정 시 나머지 ID는 차단되고, `list_data_sources`도 허용된 것만 반환합니다. |
| `REDASH_MCP_LOG` | (선택) 로그 레벨: `debug`, `info`(기본), `warn`, `error`, `silent`. MCP stdio 채널을 해치지 않도록 로그는 stderr로 출력됩니다. |
| `REDASH_MCP_AUDIT_LOG` | (선택) 감사 로그 파일 경로. 기본값 `~/.redash-mcp/audit.log`. `off`로 설정 시 비활성화. 각 줄은 도구명·인자·수행시간·상태를 담은 JSON 레코드. |
| `REDASH_QUERY_TIMEOUT_MS` | (선택) 기본 쿼리 타임아웃(ms, 기본 120000). `execute_query`의 `timeout_ms` 인자로 호출 단위 재정의 가능. |
| `REDASH_MASK_COLUMNS` | (선택) 결과에서 마스킹할 컬럼명 패턴(콤마 구분, 와일드카드 `*` 지원). `builtin`을 포함하면 이메일·전화·주민번호·패스워드·토큰·카드 등 내장 패턴도 자동 마스킹됩니다. 예: `builtin,user_name,addr*` |
| `REDASH_METADATA_TTL_DAYS` | (선택) 메타데이터 캐시 TTL(일). 설정 시 해당 일수 이상 된 항목은 `explore_column`·`find_mapping`·`get_schema`에서 캐시 미스로 간주하여 재조회하고, `get_cache` 출력에 `[stale]` 태그가 표시됩니다. 미설정 시 무기한 유지. |

## 도구

| 도구 | 설명 |
|------|------|
| `list_data_sources` | 데이터소스 목록 조회 |
| `self_test` | 진단 도구 — 환경변수·Redash 연결·스키마 조회 가능 여부 점검 |
| `get_schema` | 테이블/컬럼 스키마 조회 (키워드 필터링, 캐싱) |
| `execute_query` | SQL 실행 (`SELECT`/`WITH`만 허용, job 폴링 자동 처리, LIMIT이 없으면 `max_rows`(기본 1000) 자동 주입) |
| `explain_query` | 쿼리를 실제 실행하지 않고 `EXPLAIN`으로 비용·계획 조회 (엔진별 지원 상이) |
| `explore_column` | 컬럼의 고유값/건수 조회 및 타입 추정 (여러 컬럼 동시 탐색) |
| `sample_rows` | 테이블의 샘플 행 조회 (기본 5행) — 컬럼별 실제 값 형태를 빠르게 파악 |
| `describe_table` | 단일 테이블의 스키마 + 샘플 행을 한 번에 반환 |
| `find_table` | 컬럼명·테이블 키워드로 테이블 탐색 (조인 대상 찾기 등에 유용) |
| `join_hints` | 대상 테이블과 동일한 이름의 컬럼을 가진 다른 테이블을 조인 후보로 제안 |
| `find_mapping` | 숫자 코드 컬럼의 매핑 테이블 자동 탐색 |
| `save_query` | SQL을 Redash에 저장 (`description`·`tags` 지원) |
| `update_query` | 저장된 쿼리의 `name`·`query`·`description`·`tags` 수정 |
| `list_saved_queries` | Redash에 저장된 쿼리 목록 조회 (검색/데이터소스 필터 지원) |
| `get_saved_query` | 저장된 쿼리 ID로 SQL·메타데이터 조회 |
| `execute_saved_query` | 저장된 쿼리를 ID로 실행 (파라미터 전달 가능) |
| `list_dashboards` | Redash 대시보드 목록 조회 (검색 지원) |
| `get_dashboard` | 대시보드의 위젯과 참조하는 쿼리 ID 목록 조회 |
| `get_cache` | 메타데이터 캐시 조회 (컬럼 타입/값, 매핑 테이블, 추천 테이블) |
| `export_metadata_cache` | 메타데이터 캐시를 JSON 파일로 내보내기 (팀 공유·백업용) |
| `import_metadata_cache` | JSON 파일에서 메타데이터 캐시 가져오기 (merge/replace 모드) |

## 사용 예시

자연어 요청이 MCP 클라이언트를 통해 아래와 같이 도구 호출로 풀려나갑니다.

1. 사용자: "주문 테이블 찾아서 어제 매출 보여줘"
2. `list_data_sources` → 대상 `data_source_id` 선택
3. `get_schema` (keyword: `order`) → 후보 테이블/컬럼 파악
4. `explore_column`로 상태/타입 컬럼의 고유값·타입 확인
5. `find_mapping`으로 코드 컬럼(예: `status_cd`)을 라벨로 매핑
6. `execute_query`로 최종 `SELECT` 실행
7. (선택) `save_query`로 Redash에 저장

다음번 요청부터는 메타데이터 캐시가 재사용되어 4~5단계가 `get_cache` 한 번으로 끝나는 경우가 많습니다.

## 안전장치 / 제약사항

- **읽기 전용 SQL**: `SELECT` 또는 `WITH`로 시작하는 쿼리만 허용합니다. `INSERT`·`UPDATE`·`DELETE`·`DROP`·`ALTER`·`CREATE`·`TRUNCATE`·`MERGE`·`GRANT`·`REVOKE`·`CALL`·`EXEC` 등은 CTE 내부에 숨겨도 차단되고, 세미콜론을 이용한 다중 문장도 거부됩니다. 주석과 문자열 리터럴은 스캔 전에 제거되어 키워드 우회를 막습니다.
- **행 수 가드레일**: `execute_query`는 LIMIT이 없는 쿼리에 `LIMIT max_rows`(기본 1000)를 자동 주입하여, 풀 테이블 스캔으로 모델 컨텍스트가 터지는 사고를 방지합니다. `max_rows` 인자로 조정하거나 SQL에 `LIMIT`을 직접 지정할 수 있습니다.
- **CSV 저장**: `execute_query`에 `save_csv: "/path/to/out.csv"`를 전달하면 결과를 디스크에 저장합니다. 대용량 결과를 모델 컨텍스트 밖으로 빼낼 때 유용합니다.
- **자동 스키마 복구**: "table/column not found" 유형의 에러가 발생하면 해당 데이터소스의 스키마 캐시를 무효화·재조회하고, 갱신된 테이블 목록을 반환하여 모델이 다시 시도할 수 있게 합니다.
- **Job 폴링**: Redash의 비동기 job을 완료까지 폴링한 뒤 최종 결과만 클라이언트에 전달합니다.
- **쓰기 API 없음**: Redash 상태를 변경하는 도구는 `save_query`(새 쿼리 저장)뿐입니다.

## 데이터소스 선택 규칙

- 쿼리 관련 도구(`execute_query`, `get_schema`, `explore_column`, `find_mapping`, `save_query`)는 모두 `data_source_id`를 **필수 인자**로 받습니다.
- 먼저 `list_data_sources`로 사용 가능한 ID를 조회한 뒤, MCP 클라이언트가 명시적으로 선택한 ID를 전달해야 합니다.
- 암묵적인 "기본 데이터소스"는 의도적으로 두지 않았습니다. 여러 데이터소스가 있을 때 엉뚱한 DB에 쿼리가 나가는 사고를 방지하기 위함입니다.
- `REDASH_ALLOWED_DS=1,3,7`로 허용할 데이터소스 ID를 제한할 수 있습니다. 다른 ID는 Redash에 도달하기 전에 거부되며, `list_data_sources`·`list_saved_queries`도 허용된 항목만 반환합니다.

## 캐시

- **스키마 캐시**: 인메모리, 서버가 살아있는 동안 유지. 쿼리 실행 시 테이블/컬럼 에러가 발생하면 자동 갱신. `get_schema`의 `refresh: true`로 수동 갱신도 가능
- **메타데이터 캐시**: `~/.redash-mcp/metadata-cache.json`에 영구 저장. `explore_column`, `find_mapping` 결과를 자동 저장하여 반복 조회 시 활용. 키가 `ds<id>:` 프리픽스로 격리되므로 다른 데이터소스에 같은 이름의 테이블이 있어도 충돌하지 않습니다.

### 캐시 위치 및 초기화

| 캐시 | 위치 | 초기화 방법 |
|------|------|-------------|
| 스키마 | 인메모리 (서버 프로세스 단위) | MCP 서버 재시작, 또는 `get_schema`를 `refresh: true`로 호출 |
| 메타데이터 | `~/.redash-mcp/metadata-cache.json` | 파일 삭제(`rm ~/.redash-mcp/metadata-cache.json`) — 다음 저장 시점에 새로 생성됩니다 |

메타데이터 캐시 파일은 일반 JSON이라 필요하면 직접 열어보거나 백업/수정할 수 있습니다.

## 라이선스

[MIT](./LICENSE)
