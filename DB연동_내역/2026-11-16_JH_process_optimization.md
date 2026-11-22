# 공정 최적화 실데이터 연결 (JH, 2026-11-16)

| 항목 | 내용 |
|------|------|
| 화면 | `/casting/process-optimization` (공정 최적화) |
| 원본 | `mes.investment_casting` (NCP `aiax`) — 읽기만 |
| 계정 | `app_lake` (루트 `.env` `DATABASE_URL`, 읽기 전용) — DB 변경·새 계정 없음 |
| API | `JH/api/casting/router.py` (JH API 서버 127.0.0.1:8000에 추가) |
| | `GET /api/casting/dates?line=` 데이터 있는 날짜 (최근 먼저) |
| | `GET /api/casting/predictions?line=&date=` 그날 샷 전체, 시간순 (`Shot` 형식) |
| | `GET /api/casting/live?line=&after=` (2026-11-19) 오늘(KST) 현재 시각 이전 샷 — 첫 조회 최근 200 / `after`(castingId) 이후만 (실시간 따라가기) |
| 칼럼 매핑 | `production_count`→`shotId`, `date`(시각)→`time`, `"timestamp"`(날짜)→조회 조건, `passorfail`→`actual`, `facility_cycletime`→`facility_CycleTime`, `production_cycletime`→`production_CycleTime` |
| 화면 동작 | 날짜 선택(기본 최근 날짜) → 그날 샷을 처음부터 재생 |

**임시 규칙 (모델 연결 전)**
- 불량 확률 `prob` = 실제 판정 `passorfail`(0/1). 알람의 「불량」은 예측이 아닌 실제 판정 기준.
- 정상 범위(bands)·모델 정보는 목업 `JH/frontend/common/casting/mock/model.json` 사용.
- 불량 유형 라벨링은 목업 유지 (`fetchShots(..., real=false)`).

**2026-11-17 품질 검사(`/casting/quality-inspection`) 전환** — 같은 API 사용. 실데이터로 바로 보이는 항목만 표시: KPI(생산 샷·불량률·불량 개수, 실제 판정 기준), 샷 판정 목록 + 주요 변수, 공정 변수 모니터. 1차(ML 확률)·2차(DL 이미지) 검사는 모델 연결 후 복원.

**2026-11-18 1차(ML) 검사 연결** — `prob` = 실제 판정 → **TM 배포 모델 `DieCasting_XGB_20261114_09` 불량 점수(0~1)** 로 교체 (`JH/api/casting/model.py`, pkl 은 `TM/model/` 읽기만). 같은 조회 행(mes.investment_casting)의 `injection_pressure`·`top_temp1·2`·`bottom_temp1·2`·`biscuit_thickness`·`cooling_water_temp`·`mechanical_strength` 로 입력 8개 생성. 기준값 0.572 이상 = 1차 불량. 새 API `GET /api/casting/model`(이름·기준값·검증 성적). DB 쓰기 없음. 공정 최적화는 `prob` 를 쓰지 않아 영향 없음. 위 「임시 규칙」 첫 줄은 이 날짜부터 해당 없음.

**2026-11-19 실시간 따라가기** — 날짜가 오늘(KST)이면 `/api/casting/live` 를 5초마다 증분 조회. 조건 `"timestamp" = 오늘 AND date <= 지금`(DB 서버 시계 `now() AT TIME ZONE 'Asia/Seoul'`) — 미리 넣은 목업으로도 시각이 지날 때마다 샷이 나타나고, Kafka·Flink 가 실제 샷을 mes 에 넣으면 코드 변경 없이 그대로 동작. `/dates` 는 오늘 이후 날짜 제외. DB 쓰기 없음.

**2026-11-20 관리도(SPC) 서버 계산** — `GET /api/casting/spc?line=&key=&first=&last=` (`JH/api/casting/spc.py`). `mes.investment_casting` 에서 보이는 구간 끝 샷 이전 최대 8,100샷(앞쪽 문맥 6,000 + 구간 최대 2,100)을 `"timestamp", date, production_count` 순으로 읽어 생산 흐름(생산번호 +1 이어짐)·생산 런(흐름 안 생산번호 감소 = 재가동)별로 EWMA·MR·넬슨 2·3 계산. 기준선 = 라인별 고정 표(코드 상수). 읽기만(app_lake), DB 쓰기 없음. 응답 0.26~0.33초(실데이터 확인).

**2026-11-20 시연 배속(×20 ↔ 샷 생성)** — `GET|PUT /api/casting/demo-speed` → `mes.shot_generator_control` (init 28). app_lake 가 이 표만 UPDATE. 공정최적화 **오늘(live)** 에서 ×20 ON=20 / OFF·페이지 이탈=1. MS `shot_generator` run 이 폴링해 벽시계 대기÷speed, 배속>1 이면 INSERT 시각을 벽시계로 찍어 `/live`가 받게 함. 기록 [2026-11-20_DH_shot_generator_demo_speed.md](./2026-11-20_DH_shot_generator_demo_speed.md).
