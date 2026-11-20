# 사진 받기 API (MS 작성 → 서버 배포 DH)

MS PC 에서 보낸 주조 사진을 서버에 jpg 로 저장하고 `mes.casting_image` 에 기록해요.

```
MS PC image_sender → Kafka → Flink image_ingest ──POST /api/images──▶ 이 API
                                                     → /root/images/L1/261120/<casting_id>.jpg
                                                     → mes.casting_image (base64 · 경로 · 라벨)
```

## 규칙

| 항목 | 내용 |
|---|---|
| 주소 | `POST https://gknushift.freemyip.com/api/images` |
| 인증 | 헤더 `X-API-Key` |
| 본문 (JSON) | `casting_id`, `image_base64`, `image_label`(ok/defect), `content_type`, `original_uri` |
| 응답 | 200 저장 (같은 casting_id 는 덮어씀) / 400 값 오류·없는 casting_id / 401 키 틀림 |
| 저장 | `/root/images/L{라인}/{yymmdd}/{casting_id}.jpg` |
| 보기 | `GET /api/images/{casting_id}` → jpg |

## 보호구 게이트 실시간 화면 (MJPEG)

게이트 노트북(`MS/ppe_gate/gate_judge.py`)이 박스 친 화면을 초당 최대 30장 보내면, 웹에서 영상처럼 보여요. 저장하지 않고 메모리에 최신 1장만 둬요.

| 주소 | 뜻 |
|---|---|
| `POST /api/images/gate/{a\|b}/frame` | 게이트가 보냄 (헤더 `X-API-Key`, 본문 = jpg) |
| `GET /api/images/gate/{a\|b}/stream` | 웹페이지: `<img src="/api/images/gate/a/stream">` |
| `GET /api/images/gate/{a\|b}/latest.jpg` | 최신 1장 (확인용) |

- uvicorn 워커 1개로 실행 (기본값). nginx 설정은 안 바꿔도 돼요 (응답에 `X-Accel-Buffering: no`).
- 코드를 받은 뒤 API만 다시 시작하면 돼요: `sudo systemctl restart image_api`

## 서버에 올리기 (DH)

1. DB: `MS/db/init/27_주조이미지_경로라벨.sql` (`image_path`·`image_label` 칸) — 2026-11-20 서버 적용 완료
2. 루트 `.env` 에 추가
   - `IMAGE_API_KEY=` 긴 임의 문자열 (MS PC `.env` 의 `IMAGE_API_KEY` 와 같은 값)
   - `IMAGE_DATABASE_URL=` app_mes 계정 접속 주소 (`mes.casting_image` 쓰기 권한 있음)
   - (선택) `IMAGE_DIR=` 기본 `/root/images`. API 를 root 가 아닌 계정으로 돌리면 쓸 수 있는 폴더로
3. 실행 (둘 중 하나)
   - 단독: `cd MS/image_api && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8010` + nginx 에서 `/api/images` → 8010
   - JH API 에 합치기: `router.py`·`image_store.py` 를 JH/api 쪽에 두고 `app.include_router(...)`
4. 확인: 키 없이 POST → 401, 키 넣고 POST → 200 과 `/root/images/...jpg` 생김

## 파일

- `image_store.py` 검사·저장 처리 (FastAPI 없이 시험 가능)
- `router.py` API 주소·인증·응답
- `main.py` 단독 실행용
