# DB 연동 — org.aluminum_price (DH)

- 날짜: 2026-11-20
- 담당: DH (크롤·화면), MS (테이블·최초 CSV 적재)

## 사용

| 구분 | 내용 |
|------|------|
| 스키마.테이블 | `org.aluminum_price` |
| 컬럼 | `price_date`, `price` |
| 읽기 | DH 조회 서버 `list_prices` (`app_lake` / `DATABASE_URL`) |
| 쓰기(최초) | MS — CSV `DH/data/aluminum_price/aluminum_price_backfill.csv` INSERT 후 CSV 삭제 |
| 쓰기(이후) | DH `python -m aluminum_price daily` — 신규 `price_date`만 INSERT |

## 관련

- [`DH/전달사항/2026-11-20_MS_aluminum_price_CSV적재.md`](../DH/전달사항/2026-11-20_MS_aluminum_price_CSV적재.md)
- 페이지: `/al-price`
