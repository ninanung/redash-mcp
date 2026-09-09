---
name: npm-release
description: |
  이 패키지(@seungje.jun/redash-mcp)를 npm 에 배포한다. Trusted Publishing 이라 로컬 npm publish 없이
  버전 태그를 push 하면 GitHub Actions(.github/workflows/publish.yml)가 빌드·배포한다.
  "배포해줘", "publish", "릴리스", "npm 올려줘", "버전 올려서 배포", "npm-release" 등 요청 시 자동 트리거.
autoTrigger: true
---

npm 배포를 수행한다. 아래 절차를 순서대로 실행하고, 단계를 임의로 생략하지 않는다.
로컬에서 `npm publish` 를 직접 실행하지 않는다 — 배포 주체는 GitHub Actions 다.

## 0. 인자

- 버전 종류: `patch`(기본) / `minor` / `major`, 또는 명시 버전(예: `0.3.0`)
- 사용자가 안 주면 변경 내용으로 판단한다: 버그픽스·문구·env 추가 → patch, 새 도구·인자·출력 형태 변경 → minor, 기존 소비자가 깨지는 변경 → major

## 1. 사전 점검 (하나라도 실패하면 멈추고 사용자에게 알린다)

```bash
git status --short            # 비어 있어야 함 (미커밋 변경 금지)
git branch --show-current     # main 이어야 함. 아니면 먼저 main 에 병합
git fetch origin && git log origin/main..main --oneline   # 미푸시 커밋은 있어도 됨 (같이 push 됨)
npm ci --dry-run 2>&1 | grep -i "error"   # 락파일 동기화 확인, 출력 없어야 함
npm run build && npm run lint
```

- `readme-update-rule.md` 체크리스트 확인: 이번 릴리스에 도구·인자·env·동작 변경이 있으면 `README.md` 와 `README_kr.md` 가 둘 다 반영돼 있어야 한다.
- `package.json` 의 `repository.url` 이 `git+https://github.com/ninanung/redash-mcp.git` 인지 확인 (Trusted Publishing 매칭 조건).

## 2. 릴리스 노트 준비

`git log <직전 태그>..HEAD --oneline` 으로 변경을 모아 한 줄 요약을 만든다. 사용자에게 보여 주고 버전 종류가 맞는지 짧게 확인한다(사용자가 이미 버전을 지정했으면 생략).

## 3. 버전 올리고 태그 push

```bash
npm version <patch|minor|major|x.y.z> -m "%s"   # package.json 갱신 + 커밋 + v<버전> 태그
git push --follow-tags origin main
```

`npm version` 이 만든 태그(`v0.2.1` 형식)가 워크플로 트리거다. 태그를 손으로 만들 때도 반드시 `v` 접두를 붙인다.

## 4. 워크플로 완료 대기 및 검증

```bash
sleep 15 && gh run list --workflow=publish.yml --limit 1     # run id 확보
gh run watch <run-id> --exit-status --interval 10
npm view @seungje.jun/redash-mcp version dist.attestations   # 새 버전 + provenance 확인
```

- 실패 시 `gh run view <run-id> --log-failed` 로 원인을 본다.
  - OIDC/403 → npmjs.com 패키지 Settings 의 Trusted Publisher(org `ninanung`, repo `redash-mcp`, workflow `publish.yml`)와 불일치. 설정은 사용자가 직접 고쳐야 한다.
  - 빌드/린트 실패 → 코드 수정 후 커밋, 태그 삭제(`git tag -d v<버전> && git push origin :refs/tags/v<버전>`) 후 3번부터 재실행.

## 5. 후속

- 이 패키지를 쓰는 소비자(예: csai 의 `.mcp.json` 은 `npx -y @seungje.jun/redash-mcp@<버전>` 으로 고정)에게 새 버전과 env·인자 변경을 알린다. 세션 간 메시지 요청이 있었으면 그 세션에 회신한다.
- 로컬 MCP 서버는 재시작해야 새 버전이 반영된다고 사용자에게 알린다.

## 수동 배포 폴백

GitHub Actions 를 못 쓰는 상황에서만 로컬 publish 를 고려한다. 이때는 `.claude/rules/npm-publish-rule.md`(`npm whoami` 가 `seungje.jun` 일 때만)를 따르고, 계정 2FA 때문에 대화형 터미널에서 사용자가 직접 `npm publish --access public` 을 실행해야 한다. 이 세션의 셸은 비대화형이라 OTP/passkey 인증을 받을 수 없다.
