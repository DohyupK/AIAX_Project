# 전달: JH 플랫폼 인덱스 루트 연결 요청 (→ DH)

- 작성: JH / 2026-11-06
- 내용: `JH/main/index.ts` 에서 `PlatformIndex`(사이드바만), `PlatformLayout`(사이드바 + 회색 본문)을 export 합니다.
- 의도: JH 메뉴 클릭 시 열리는 하위 페이지가 **아님**. 전체 화면 구성(좌측 인덱스 + 회색 본문)을 이 형태로 바꾸려는 것입니다.
- 요청:
  1. 루트 `page_registry.md` 등록 승인
  2. 루트 `app/layout.tsx` 에서 기존 `AppShell` 대신 `JH/main` 의 `PlatformLayout` 으로 감싸도록 연결
     ```tsx
     import { PlatformLayout } from "@/JH/main";
     // <body><PlatformLayout>{children}</PlatformLayout></body>
     ```
- 참고: 루트 `tsconfig.json` 이 `JH` 를 exclude 하고 있어 타입 검사 범위에서 빠져 있습니다. import 시 빌드는 되지만 필요하면 조정 검토 부탁드립니다.
- JH는 루트 파일을 수정하지 않았습니다.
