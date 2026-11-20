# 전달사항 — 알루미늄 시세 CSV 적재 후 삭제 (DH → MS)

- 작성: DH, 2026-11-20
- 대상: MS (`org.aluminum_price`)
- 상태: DH 크롤·페이지 구현. **최초 1회 CSV 적재는 MS**, 이후 증분은 DH `daily`가 DB 직접 INSERT

## 요청

1. DH가 만든 백필 CSV를 **`org.aluminum_price`에 그대로 INSERT** 한다.
2. 적재가 끝나면 **해당 CSV 파일을 삭제**한다 (남겨 두지 말 것).
3. 테이블에 `price_date` **UNIQUE/PK** 가 있어야 이후 DH 증분 `ON CONFLICT DO NOTHING` 이 동작한다.

## CSV

| 항목 | 내용 |
|------|------|
| 생성 명령 | `cd DH/api && uv run python -m aluminum_price backfill` |
| 기본 경로 | `DH/data/aluminum_price/aluminum_price_backfill.csv` |
| 컬럼 | `price_date` (YYYY-MM-DD), `price` (Al, US$/톤) |
| 헤더 1행 | 있음 |

예시:

```csv
price_date,price
2026-11-05,3160
2026-11-04,3135
```

## 테이블 계약

`org.aluminum_price`

| 컬럼 | 타입 권장 | 의미 |
|------|-----------|------|
| `price_date` | `date` PK/UNIQUE | 협회 「일자」 |
| `price` | `numeric` | Al LME 현물 US$/톤 |

- 읽기·쓰기(이후 증분): `app_lake` (`DATABASE_URL`)
- DDL·init 번호 편입은 MS 담당 (레포에 DH DDL 초안 없음 — 팀에서 이미 정의한 테이블 사용)

## 이후 운영 (CSV 없음)

```bash
# Ubuntu cron 05:00 KST — DH
CRON_TZ=Asia/Seoul
0 5 * * * cd /root/AIAX_Project/DH/api && /root/.local/bin/uv run python -m aluminum_price daily >> /var/log/aluminum_price_daily.log 2>&1
```

- p.1만 크롤 → `MAX(price_date)` 보다 새 일자만 INSERT
- CSV 재생성 없음

## 화면

- 페이지: `/al-price` (DH `al_price`)
- 브라우저: `GET /api/al-price/prices` (same-origin) → Next rewrite 또는 nginx → `127.0.0.1:8766`
- 서버 기동: `myapp` tmux 창 `al_price` = `uv run python -m aluminum_price serve`
