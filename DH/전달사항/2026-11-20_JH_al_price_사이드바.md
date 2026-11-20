# 전달사항 — 알루미늄 가격 사이드바 링크 (DH → JH)

- 작성: DH, 2026-11-20
- 대상: JH (`PlatformIndex` 사이드바)
- 상태: DH 페이지 `/al-price` · `DH/main/al_price` 준비. **사이드바는 JH 폴더**라 DH가 수정하지 않음

## 요청

[`JH/frontend/pages/platform_index/PlatformIndex.tsx`](../../JH/frontend/pages/platform_index/PlatformIndex.tsx) `SECTIONS`에 항목 추가:

- label: `알루미늄 가격`
- href: `/al-price`

위치는 JH 판단 (예: 경영 관리자 리포트 근처).

## 참고

- 루트 `app/al-price/page.tsx` → `DH/main/al_price`
- `page_registry.md` 등록은 DH가 승인 문구 후 진행
