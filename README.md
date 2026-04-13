# redash-mcp

Redash API를 MCP(Model Context Protocol) 서버로 제공합니다.

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

## 도구

| 도구 | 설명 |
|------|------|
| `list_data_sources` | 데이터소스 목록 조회 |
| `get_schema` | 테이블/컬럼 스키마 조회 (키워드 필터링, 캐싱) |
| `execute_query` | SQL 실행 (`SELECT`/`WITH`만 허용, job 폴링 자동 처리) |
| `explore_column` | 컬럼의 고유값/건수 조회 및 타입 추정 (여러 컬럼 동시 탐색) |
| `find_mapping` | 숫자 코드 컬럼의 매핑 테이블 자동 탐색 |
| `save_query` | SQL을 Redash에 저장 |
| `get_cache` | 메타데이터 캐시 조회 (컬럼 타입/값, 매핑 테이블, 추천 테이블) |

## 캐시

- **스키마 캐시**: 인메모리, 서버가 살아있는 동안 유지. 쿼리 실행 시 테이블/컬럼 에러가 발생하면 자동 갱신. `get_schema`의 `refresh: true`로 수동 갱신도 가능
- **메타데이터 캐시**: `~/.redash-mcp/metadata-cache.json`에 영구 저장. `explore_column`, `find_mapping` 결과를 자동 저장하여 반복 조회 시 활용
