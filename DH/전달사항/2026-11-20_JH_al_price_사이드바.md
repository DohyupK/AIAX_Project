# 전달사항 — 알루미늄 가격 사이드바 링크 (DH → JH)

- 작성: DH, 2026-11-20
- 대상: JH (`PlatformIndex` 사이드바)
- 상태: **JH 반영 완료** — `PlatformIndex.tsx` SECTIONS에 `/al-price` 직접 추가됨

## 반영 내용

```ts
{ title: "알루미늄 가격", href: "/al-price", items: [] },
```

위치: 경영 관리자 리포트 다음.

## 참고

- 루트 `page_registry.md` — id `al_price` 등록됨
- 라우트: `app/al-price/page.tsx` → `DH/main/al_price`
