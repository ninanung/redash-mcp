# npm publish 규칙

## 원칙

`npm publish` 실행 전 반드시 `npm whoami`로 인증된 사용자를 확인하고, 허용된 사용자일 때만 진행한다.

## 절차

1. `npm whoami`를 실행한다
2. 출력이 `seungje.jun`인 경우에만 publish를 진행한다
3. 다른 사용자이거나 인증 실패 시 publish를 중단하고 사용자에게 알린다

## 이유

잘못된 npm 계정으로 패키지가 배포되는 것을 방지한다.
