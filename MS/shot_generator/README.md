# 실시간 샷 생성기

작성: MS, 2026-11-20. 이 폴더 하나만 복사하면 돌아갑니다.

## 무엇인가

- TM 규칙(실시간용 규칙 1~6)으로 라인 3개의 샷을 만들어 **`mes.investment_casting`에 바로 저장**해요. Kafka는 거치지 않아요.
- 라인마다 약 150초에 1샷을 만들어요(1배속). 켜지면 **DB의 라인별 마지막 샷에서 이어서** 만들어요.
- 시연 배속: `--speed 20` (systemd 기본). **사이클 값·샷 간격** ÷20(~150→~7.5초), DB 시각은 벽시계(`/live`가 받게). 배속용 별도 표·API 없음.
- 꺼져 있던 동안의 샷은 다시 켜질 때 한꺼번에 채워요. 그래서 공백이 생기지 않아요.
- DB가 끊기면 같은 샷을 10초마다 다시 시도해요. 샷을 버리지 않아요.
- 이미지는 다루지 않아요. MS PC의 `MS/db/apps` 안에 있는 `apps.image_sender`가 따로 붙여요.
- 메모리는 약 40MB, DB 계정은 `app_mes`를 써요.

## 폴더 구성

| 파일 | 역할 |
|---|---|
| `shot_generator.py` | 생성기 본체 |
| `shot_params.json` | 규칙 값 목록. **반드시 같은 폴더에 있어야 해요** |
| `requirements.txt` | 필요한 패키지 (numpy, psycopg, tzdata) |
| `shot_generator.service` | 서버 상시 실행 설정 (systemd) |
| `shot_params.py` | `shot_params.json`을 다시 만들 때만 써요. MS PC 전용이고, 원본 CSV가 바뀔 때만 실행해요 |
| `.env` | 직접 만들어요. 저장소에는 올리지 않아요 |

## 실행

```bash
pip install -r requirements.txt                       # 파이썬 3.10 이상

python shot_generator.py --mode test --speed 50 --shots 10   # 시험: 화면에만 출력, DB 안 씀
python shot_generator.py --mode fast --shots 20000 --out fast.csv   # 검증: CSV + 규칙 비교표
python shot_generator.py --mode run                   # 운영 1배
python shot_generator.py --mode run --speed 20        # 시연 20배 (권장)
```

`.env` 예시 (같은 폴더):
```
DATABASE_URL=postgresql://app_mes:<비밀번호>@127.0.0.1:5432/<DB이름>
```
`.env`가 이 폴더에 없으면 위쪽 폴더의 `.env`를 찾아요. 저장소 루트의 `.env`는 읽기 계정이라 `run` 모드에서는 저장이 안 돼요.

## 서버 상시 실행 (우분투)

```bash
sudo cp -r shot_generator /opt/aiax/                  # 이 폴더를 통째로 복사
cd /opt/aiax/shot_generator
sudo python3 -m venv venv && sudo venv/bin/pip install -r requirements.txt
sudo nano .env && sudo chmod 600 .env                 # DATABASE_URL 입력
sudo venv/bin/python shot_generator.py --mode test --speed 50 --shots 10   # 동작 확인

sudo cp shot_generator.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shot_generator
```

| 할 일 | 명령 |
|---|---|
| 상태 확인 | `systemctl status shot_generator` |
| 로그 보기 | `journalctl -u shot_generator -f` |
| 멈춤 / 다시 시작 | `sudo systemctl stop shot_generator` / `sudo systemctl restart shot_generator` |

서버를 재부팅하면 자동으로 시작돼요. 프로그램이 죽으면 10초 뒤 자동으로 다시 시작돼요.

## 시작 전 확인

- mes에 **미래 시각 샷**(미리 넣어 둔 목업)이 있으면, 생성기는 그 마지막 샷 뒤부터 이어서 만들어요. 지금 시각부터 시작하려면 미래 샷을 먼저 정리해야 해요 (MS 담당).
- 시험 테이블에 먼저 넣어 보려면 `--table mes.investment_casting_test`를 붙여요. 테이블은 MS가 만들어요:
  `CREATE TABLE mes.investment_casting_test (LIKE mes.investment_casting INCLUDING ALL);`
