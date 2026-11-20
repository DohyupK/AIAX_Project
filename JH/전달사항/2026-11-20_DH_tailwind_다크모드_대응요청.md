# 전달: Tailwind v4 도입·다크 모드 — DH 화면 대응 요청 (→ DH)

- 작성: JH / 2026-11-20
- 상태: 요청 (DH 루트 변경은 승인 완료, 아래는 DH 폴더·루트 잔여 항목)

## 바뀐 것 (루트, DH 승인)

- `package.json`: devDependency `tailwindcss` · `@tailwindcss/postcss` · `postcss` · `@tailwindcss/forms`
- `postcss.config.mjs` 신규, `app/globals.css` Tailwind + Mosaic 디자인 값(회색·상태색·글자 크기, 강조색 `brand-*` = 현대 남색)
- `app/layout.tsx`: Inter 폰트(`next/font`), `<html class="dark">` 깜빡임 방지 스크립트(`ThemeScript`), body 기본색 `bg-gray-100 / dark:bg-gray-900`
- Tailwind 기본 초기화(preflight)가 켜져 있음. 기존 CSS Modules 규칙이 우선하지만, **브라우저 기본값(제목 여백·목록 점·버튼 배경 등)에 기대던 부분**은 모양이 바뀔 수 있음

## 요청

1. `DH/frontend/pages/al_price`, `hyejin_bot` 화면 확인 — 초기화 스타일로 깨진 곳이 있는지
2. 다크 모드 대응 — `html.dark` 일 때 색이 바뀌도록 (Tailwind `dark:` 클래스 또는 CSS Modules에서 `:global(.dark) .클래스`)
3. 루트 `app/loading.tsx`: 회색 상수(`#e8e8e8` 등)가 직접 적혀 있어 다크 모드에서 밝게 보임 → `bg-gray-200 dark:bg-gray-800` 등으로 교체 검토

## 참고

- 다크 모드는 JH 페이지 이식이 끝날 때까지 **개발 모드에서만** 켜짐 (`JH/frontend/common/theme/ThemeScript.tsx` `THEME_TOGGLE_ENABLED`). 배포 화면은 라이트 고정
- JH는 DH 폴더를 수정하지 않았습니다.
