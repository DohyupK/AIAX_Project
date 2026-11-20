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
