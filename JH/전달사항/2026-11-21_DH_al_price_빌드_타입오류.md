# 전달: `pnpm build` 실패 — al_price 타입 오류 (→ DH)

- 작성: JH / 2026-11-21
- 상태: 요청 (DH 폴더라 JH는 수정하지 않음)
- 발생: upstream `dev` `d476ddb pr_add` 반영 후 `pnpm build` (타입 검사 단계). `pnpm dev`는 타입 검사를 안 해서 안 보임

## 오류

```
./DH/frontend/pages/al_price/AlPrice.tsx:161:39
Type error: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  const rows = await loadPage(meta.max_date, page);
```

- 164행 `prefetchPage(meta.max_date, …)` 도 같은 원인
- `useEffect` 맨 위 `if (!meta?.max_date …) return;` 으로 걸렀지만, 아래 `async` 함수 안에서는 TypeScript가 그 확인을 이어받지 못함 (`meta` 가 state 객체라 클로저 안에서 좁히기 풀림)

## 제안 (한 줄)

```tsx
if (!booted || !meta?.max_date || loading) return;
const maxDate = meta.max_date;   // 여기서 string 으로 고정
// 아래 loadPage(maxDate, page) / prefetchPage(maxDate, page + 1, pages)
```

## 영향

- 배포 빌드(`next build`)가 막혀 **전체 사이트 배포 불가** — 개발 서버 실행은 됨
# DH — al_price 빌드 타입 오류 (2026-11-21)

| 항목 | 내용 |
|------|------|
| 현상 | `pnpm build` / `tsc --noEmit` 실패 |
| 원인 커밋 | `d476ddb` (dev) |
| 파일 | `DH/frontend/pages/al_price/AlPrice.tsx` 161·164행 부근 |
| 내용 | `meta.max_date` 가 `string \| null` 인데 `loadPage`/`prefetchPage` 인자는 `string` |

## 수정 (DH 폴더, 이미 반영)

페이지 탭 effect 안에서 guard 직후 지역 변수로 좁힘:

```ts
if (!booted || !meta?.max_date || loading) return;
const maxDate = meta.max_date;
// loadPage(maxDate, …) / prefetchPage(maxDate, …)
```

다른 폴더 수정 없음.
