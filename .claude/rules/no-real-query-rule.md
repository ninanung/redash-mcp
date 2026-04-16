# 실제 쿼리/테이블명 사용 금지 규칙

## 원칙

코드 내에서 실제 운영 테이블명, 컬럼명, 스키마명, 쿼리를 예시로 사용하지 않는다.

## 이유

오픈소스 프로젝트에 실제 DB 스키마 정보가 노출되면 보안 위험이 된다.

## 적용 범위

- 소스 코드 (`src/**`)
- Tool description, inputSchema 의 예시 값
- README 예시
- 테스트 코드

## 규칙

- **금지**: 실제 스키마명(`bh_xxx`), 테이블명(`order_total`), 컬럼명(`lastest_state`), 파티션 키(`p_ymd`) 등 운영 DB에 존재하는 이름
- **허용**: 일반적/가상의 이름 사용 (`schema.table_name`, `user_id`, `status_code`, `partition_col` 등)
- 예시에 날짜 값이 필요한 경우 `'value'` 또는 `'2024-01-01'` 같은 가상의 값을 사용한다

## 예시

```typescript
// O
description: "Source table (e.g. schema.table_name)"
description: "Partition filter (e.g. partition_col = 'value')"

// X
description: "Source table (e.g. bh_idusme.order_total)"
description: "Partition filter (e.g. p_ymd = '20260413')"
```
