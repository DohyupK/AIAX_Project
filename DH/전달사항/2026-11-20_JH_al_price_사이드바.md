# 전달사항 — 알루미늄 가격 사이드바 링크 (DH → JH)

- 작성: DH, 2026-11-20
- 대상: JH (`PlatformIndex` 사이드바)
- 상태: **page_registry 등록 완료**. 사이드바는 JH 폴더라 DH 수정 금지 — **JH 반영 요청**

## 요청 (필수)

[`JH/frontend/pages/platform_index/PlatformIndex.tsx`](../../JH/frontend/pages/platform_index/PlatformIndex.tsx) 의 `SECTIONS`에 아래를 추가해 주세요.  
(예: 「경영 관리자 리포트」 다음)

```ts
{ title: "알루미늄 가격", href: "/al-price", items: [] },
```

지금 `SECTIONS`에는 `/al-price`가 없어 왼쪽 메뉴에 「알루미늄 가격」이 안 보입니다.  
주소 `/al-price`로는 페이지가 열립니다.

## 이미 된 것 (DH)

| 항목 | 내용 |
|------|------|
| 등록표 | 루트 `page_registry.md` — id `al_price`, 표시명 알루미늄 가격, 소유자 DH |
| 라우트 | `app/al-price/page.tsx` → `DH/main/al_price` |
| 화면 | `DH/frontend/pages/al_price/` — `org.aluminum_price` 조회(serve :8766) |

## 확인

메뉴 클릭 → `/al-price` 이동. 데이터는 `uv run python -m aluminum_price serve` + DB 적재 후 표시.
