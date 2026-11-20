r"""보호구 게이트 판정 프로그램 (2026-11-20, MS)

시나리오
  1. 작업자가 게이트 앞에서 카드를 찍음        (시연: 화면 창에 카드 번호 입력 + Enter)
  2. 카메라가 3초 동안 작업자를 봄             (프레임마다 YOLO 감지, 메모리에서만 셈)
  3. 보호구별로 프레임 비율로 착용/미착용/모름 판정 → 통과 / 위반 / 판정 불가
  4. DB 저장: 출입 기록(org.employee_gate_log 또는 vendor_gate_log) 1줄 + 판정(ai.ppe_check) 1줄
  5. 위반·판정 불가면 알람. 안전관리자(안전부)가 와서 조치하고 카드를 찍으면
     P(통과·오판) / V(위반 확인)를 골라 같은 판정 줄에 manual_result·manual_by·manual_at 저장 → 알람 해제

판정 규칙 (프레임 비율)
  - 사람(Person)이 잡힌 프레임만 셈. 사람이 잡힌 프레임이 --min-person 비율보다 적으면 전부 모름(null)
  - 보호구마다: 착용 클래스가 잡힌 비율 ≥ --ratio → true, 미착용(no_*) 비율 ≥ --ratio → false, 둘 다 아니면 null
  - 게이트 필수 보호구(ai.ppe_gate_rule) 중 false 가 하나라도 → violation, 아니고 null 이 하나라도 → undecidable, 전부 true → pass
  - 클래스별 신뢰도 기준값 = 004 임계값 결과 (안전모는 머리카락 오검출 때문에 0.75)

실행 (D:\cas_image 의 가상환경 — ultralytics·torch·opencv 가 있음, psycopg 만 추가 설치)
  D:\cas_image\.venv\Scripts\python.exe -m pip install "psycopg[binary]"
  D:\cas_image\.venv\Scripts\python.exe D:\GitHub\AIAX_Project\MS\ppe_gate\gate_judge.py --gate a
  --no-db  : DB 없이 판정만 (화면·콘솔 출력)
  --goggles-conf 0.6 : 보안경 기준값 올리기 (일반 안경 오인식 줄이기)
  모델 = DB 의 보호구 배포 모델(file_path), 없거나 파일이 없으면 --model 또는 004 기본 경로
설정: 이 폴더의 .env  →  DATABASE_URL=postgresql://<계정>:<비밀번호>@49.50.143.236:5432/<DB이름>

실시간 화면 송출 (2026-11-20): 박스 친 화면을 초당 --stream-fps 장씩 서버 사진 받기 API 로 보냄
  웹에서 보기: <img src="https://gknushift.freemyip.com/api/images/gate/a/stream">
  키 = .env 의 IMAGE_API_KEY (이 폴더 .env → 없으면 저장소 루트 .env). 키가 없거나 --no-stream 이면 송출 안 함
  송출이 끊겨도 판정은 그대로 계속됨 (별도 스레드, 실패하면 몇 초 뒤 다시 시도)
"""
from __future__ import annotations

import argparse
import http.client
import os
import sys
import threading
import time
from urllib.parse import urlparse
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    KST = ZoneInfo("Asia/Seoul")
except Exception:  # Windows 에 tzdata 가 없을 때
    KST = timezone(timedelta(hours=9), "KST")

HERE = Path(__file__).resolve().parent
DEFAULT_MODEL = r"D:\cas_image\ppe\experiments\004_yolo26s_960_light_augmentation\runpod_result\PPE_YOLO26s_20261118_04.pt"
SAFETY_DEPT = "안전부"

# DB 칸 이름 → (착용 클래스, 미착용 클래스). 모델의 boots = DB 의 shoes
ITEMS = {
    "helmet": ("helmet", "no_helmet"),
    "shoes": ("boots", "no_boots"),
    "vest": ("vest", "no_vest"),
    "gloves": ("gloves", "no_gloves"),
    "goggles": ("goggles", "no_goggle"),
}
# 004 임계값 결과 (검증 200장). helmet 은 웹캠 오검출(머리카락) 때문에 0.75
THRESHOLDS = {
    "helmet": 0.75, "gloves": 0.45, "vest": 0.60, "boots": 0.40, "goggles": 0.45, "Person": 0.45,
    "no_helmet": 0.60, "no_goggle": 0.30, "no_gloves": 0.60, "no_boots": 0.60, "no_vest": 0.60,
}


def log(msg: str) -> None:
    print(f"[gate {datetime.now(KST):%H:%M:%S}] {msg}", flush=True)


def load_env(path: Path) -> None:
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


# ---------------------------------------------------------------- 판정 (카메라·DB 와 무관, 단독 시험 가능)
class Streamer:
    """최신 화면 1장을 들고 있다가 별도 스레드가 서버로 POST (keep-alive). 느리면 중간 화면은 건너뜀"""

    def __init__(self, url: str, key: str):
        self.url, self.key = urlparse(url), key
        self.frame: bytes | None = None
        self.lock = threading.Lock()
        self.new = threading.Event()
        self.conn = None
        self.sent = 0
        self.fail_logged = 0.0
        threading.Thread(target=self._run, daemon=True).start()

    def put(self, jpg: bytes) -> None:
        with self.lock:
            self.frame = jpg
        self.new.set()

    def _connect(self):
        cls = http.client.HTTPSConnection if self.url.scheme == "https" else http.client.HTTPConnection
        return cls(self.url.hostname, self.url.port, timeout=5)

    def _run(self) -> None:
        while True:
            self.new.wait()
            self.new.clear()
            with self.lock:
                jpg = self.frame
            try:
                if self.conn is None:
                    self.conn = self._connect()
                self.conn.request("POST", self.url.path, body=jpg,
                                  headers={"Content-Type": "image/jpeg", "X-API-Key": self.key})
                res = self.conn.getresponse()
                res.read()
                if res.status != 200:
                    raise RuntimeError(f"HTTP {res.status}")
                self.sent += 1
                if self.sent == 1:
                    log(f"실시간 화면 송출 시작 → {self.url.geturl().replace('/frame', '/stream')}")
            except Exception as e:   # 서버·네트워크 문제 — 판정은 계속, 3초 뒤 다시
                if self.conn is not None:
                    self.conn.close()
                self.conn = None
                if time.monotonic() - self.fail_logged > 30:
                    self.fail_logged = time.monotonic()
                    log(f"화면 송출 실패 (판정은 계속): {e}")
                time.sleep(3)


def observe(detections: list[tuple[str, float]], thresholds: dict[str, float] = THRESHOLDS) -> dict:
    """프레임 1장 → {"person": bool, 보호구: "worn" | "missing" | None}. detections = [(클래스 이름, 신뢰도)]"""
    best: dict[str, float] = {}
    for name, conf in detections:
        if conf >= thresholds.get(name, 1.01) and conf > best.get(name, 0):
            best[name] = conf
    obs: dict = {"person": "Person" in best}
    for item, (worn, missing) in ITEMS.items():
        w, m = best.get(worn, 0), best.get(missing, 0)
        obs[item] = "worn" if w and w >= m else ("missing" if m else None)
    return obs


@dataclass
class Tally:
    """3초 동안의 프레임 결과 모음"""
    frames: int = 0
    person: int = 0
    worn: dict = field(default_factory=lambda: {k: 0 for k in ITEMS})
    missing: dict = field(default_factory=lambda: {k: 0 for k in ITEMS})

    def add(self, obs: dict) -> None:
        self.frames += 1
        if not obs["person"]:
            return
        self.person += 1
        for item in ITEMS:
            if obs[item] == "worn":
                self.worn[item] += 1
            elif obs[item] == "missing":
                self.missing[item] += 1

    def items(self, ratio: float, min_person: float) -> dict[str, bool | None]:
        """보호구별 true(착용) / false(미착용) / None(모름)"""
        if self.frames == 0 or self.person / self.frames < min_person:
            return {k: None for k in ITEMS}
        out: dict[str, bool | None] = {}
        for item in ITEMS:
            if self.worn[item] / self.person >= ratio:
                out[item] = True
            elif self.missing[item] / self.person >= ratio:
                out[item] = False
            else:
                out[item] = None
        return out


def decide(items: dict[str, bool | None], required: dict[str, bool]) -> str:
    """게이트 필수 보호구 기준 최종 결과"""
    need = [items[k] for k in ITEMS if required.get(k)]
    if any(v is False for v in need):
        return "violation"
    if any(v is None for v in need):
        return "undecidable"
    return "pass"


# ---------------------------------------------------------------- DB
class Db:
    DEFAULT_RULES = {"a": dict.fromkeys(ITEMS, True), "b": {**dict.fromkeys(ITEMS, True), "goggles": False}}

    def __init__(self, url: str | None):
        self.conn = None
        if url:
            import psycopg
            self.conn = psycopg.connect(url, connect_timeout=15, autocommit=True)

    def rules(self) -> dict[str, dict[str, bool]]:
        if not self.conn:
            return self.DEFAULT_RULES
        rows = self.conn.execute("SELECT gate, helmet, shoes, vest, gloves, goggles FROM ai.ppe_gate_rule").fetchall()
        return {r[0]: dict(zip(ITEMS, r[1:])) for r in rows}

    def deployed_model(self) -> str | None:
        if not self.conn:
            return None
        row = self.conn.execute("SELECT file_path FROM ai.model_registry WHERE process_code = 'SAFE-PPE' AND deployed").fetchone()
        return row[0] if row else None

    def card(self, text: str) -> dict | None:
        """카드 번호(ec0001·vc0001) 또는 사번(e0001) → 카드 정보. 없으면 None"""
        t = text.strip().lower()
        if not self.conn:
            kind = "vendor" if t.startswith("vc") else "employee"
            return {"kind": kind, "card_id": t, "employee_no": None if kind == "vendor" else t,
                    "who": t, "safety": t.startswith("s"), "gate_a": True, "gate_b": True}
        row = self.conn.execute(
            """SELECT c.card_id, c.employee_no, d.dept_name, coalesce(g.gate_a, false), coalesce(g.gate_b, false)
               FROM org.employee_card c
               JOIN org.employee e ON e.employee_no = c.employee_no
               LEFT JOIN org.department d ON d.dept_code = e.dept_code
               LEFT JOIN org.gate_card g ON g.employee_card_id = c.card_id
               WHERE lower(c.card_id) = %s OR lower(c.employee_no) = %s""", (t, t)).fetchone()
        if row:
            return {"kind": "employee", "card_id": row[0], "employee_no": row[1], "who": f"{row[1]} {row[2] or ''}".strip(),
                    "safety": row[2] == SAFETY_DEPT, "gate_a": row[3], "gate_b": row[4]}
        row = self.conn.execute(
            """SELECT w.card_id, v.vendor_name, coalesce(g.gate_a, false), coalesce(g.gate_b, false)
               FROM org.vendor_worker w
               JOIN org.vendor_company v ON v.vendor_code = w.vendor_code
               LEFT JOIN org.gate_card g ON g.vendor_card_id = w.card_id
               WHERE lower(w.card_id) = %s AND w.card_returned_at IS NULL""", (t,)).fetchone()
        if row:
            return {"kind": "vendor", "card_id": row[0], "employee_no": None, "who": f"{row[0]} {row[1]}",
                    "safety": False, "gate_a": row[2], "gate_b": row[3]}
        return None

    def record(self, card: dict, gate: str, tagged_at: datetime, items: dict, result: str) -> int | None:
        """출입 1줄 + 판정 1줄 (한 트랜잭션). 판정 번호 반환"""
        if not self.conn:
            return None
        with self.conn.transaction():
            if card["kind"] == "employee":
                log_idx = self.conn.execute(
                    """INSERT INTO org.employee_gate_log (employee_card_id, work_date, gate, clock_in_at, in_out)
                       VALUES (%s, %s, %s, %s, 'IN') RETURNING employee_gate_log_idx""",
                    (card["card_id"], tagged_at.date(), gate, tagged_at)).fetchone()[0]
                col = "employee_gate_log_idx"
            else:
                log_idx = self.conn.execute(
                    """INSERT INTO org.vendor_gate_log (vendor_card_id, work_date, clock_in_at, in_out)
                       VALUES (%s, %s, %s, 'IN') RETURNING vendor_gate_log_idx""",
                    (card["card_id"], tagged_at.date(), tagged_at)).fetchone()[0]
                col = "vendor_gate_log_idx"
            return self.conn.execute(
                f"""INSERT INTO ai.ppe_check ({col}, helmet, shoes, vest, gloves, goggles, result)
                    VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING ppe_check_idx""",
                (log_idx, items["helmet"], items["shoes"], items["vest"], items["gloves"], items["goggles"], result)).fetchone()[0]

    def resolve(self, check_idx: int | None, manager_no: str, manual_result: str) -> None:
        """안전관리자 태깅 → 알람 해제"""
        if not self.conn or check_idx is None:
            return
        self.conn.execute(
            """UPDATE ai.ppe_check SET manual_result = %s, manual_by = %s, manual_at = now()
               WHERE ppe_check_idx = %s AND manual_at IS NULL""", (manual_result, manager_no, check_idx))


# ---------------------------------------------------------------- 게이트 (카메라 + 화면)
class Gate:
    """상태: idle(카드 대기) → judging(3초) → alarm(안전관리자 대기) → confirm(P/V 선택) → idle"""

    def __init__(self, args, db: Db):
        self.args, self.db = args, db
        self.rules = db.rules()
        if args.gate not in self.rules:
            raise SystemExit(f"[gate] 게이트 {args.gate} 규칙이 ai.ppe_gate_rule 에 없습니다")
        self.state, self.buffer, self.message = "idle", "", "Tag card: type ID + Enter"
        self.card: dict | None = None
        self.tally = Tally()
        self.deadline = 0.0
        self.tagged_at: datetime | None = None
        self.alarm: dict | None = None   # {"idx", "result", "card", "items"}
        self.manager: dict | None = None
        self.last_beep = 0.0

    # 카드 입력 처리
    def submit(self, text: str) -> None:
        if not text:
            return
        card = self.db.card(text)
        if card is None:
            self.message = f"Unknown card: {text}"
            log(f"모르는 카드: {text}")
            return
        if self.state == "alarm":
            if card["safety"]:
                self.manager, self.state = card, "confirm"
                self.message = f"Safety manager {card['who']}: P = pass (false alarm), V = violation confirmed"
            else:
                self.message = "ALARM - waiting for safety manager card"
            return
        if not card[f"gate_{self.args.gate}"]:
            self.message = f"NO ACCESS at gate {self.args.gate}: {card['who']}"
            return
        self.card, self.tally = card, Tally()
        self.tagged_at = datetime.now(KST)
        self.deadline = time.monotonic() + self.args.seconds
        self.state, self.message = "judging", f"Scanning {card['who']} - stand still"
        log(f"카드 {card['who']} — {self.args.seconds:g}초 판정 시작")

    def finish(self) -> None:
        items = self.tally.items(self.args.ratio, self.args.min_person)
        result = decide(items, self.rules[self.args.gate])
        idx = self.db.record(self.card, self.args.gate, self.tagged_at, items, result)
        log(f"{self.card['who']} gate={self.args.gate} {result} {items} "
            f"(frames {self.tally.frames}, person {self.tally.person}) check={idx}")
        if result == "pass":
            self.state, self.message = "idle", f"PASS {self.card['who']} - gate open"
        else:
            missing = [k for k, v in items.items() if self.rules[self.args.gate].get(k) and v is not True]
            self.alarm = {"idx": idx, "result": result, "card": self.card, "missing": missing}
            self.state = "alarm"
            self.message = f"ALARM {result.upper()} {self.card['who']}: {', '.join(missing)} - safety manager card"

    def confirm(self, manual_result: str) -> None:
        self.db.resolve(self.alarm["idx"], self.manager["employee_no"], manual_result)
        log(f"안전관리자 {self.manager['who']} 확인 {manual_result} check={self.alarm['idx']}")
        self.message = f"Alarm cleared by {self.manager['who']} ({manual_result})"
        self.alarm, self.manager, self.state = None, None, "idle"

    def key(self, k: int) -> bool:
        """키 입력. False = 종료"""
        if k == 27:
            return False
        if self.state == "confirm":
            if k in (ord("p"), ord("P")):
                self.confirm("pass")
            elif k in (ord("v"), ord("V")):
                self.confirm("violation")
            return True
        if self.state == "judging":
            return True
        if k in (13, 10):
            text, self.buffer = self.buffer, ""
            self.submit(text)
        elif k == 8:
            self.buffer = self.buffer[:-1]
        elif 32 < k < 127 and len(self.buffer) < 20:
            self.buffer += chr(k)
        return True

    def beep(self) -> None:
        if self.state in ("alarm", "confirm") and time.monotonic() - self.last_beep > 1.0:
            self.last_beep = time.monotonic()
            try:
                import winsound
                winsound.MessageBeep(winsound.MB_ICONHAND)
            except Exception:
                print("\a", end="", flush=True)


def detections_of(result, names: dict[int, str]) -> list[tuple[str, float]]:
    return [(names[int(b.cls.item())], float(b.conf.item())) for b in result.boxes]


def draw(cv2, frame, result, names, gate: Gate):
    out = frame.copy()
    for b in result.boxes:
        name, conf = names[int(b.cls.item())], float(b.conf.item())
        if conf < THRESHOLDS.get(name, 1.01) or name == "Person":
            continue
        x1, y1, x2, y2 = (int(v) for v in b.xyxy[0].tolist())
        color = (0, 0, 230) if name.startswith("no_") else (0, 190, 0)
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        cv2.putText(out, f"{name} {conf:.2f}", (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    h, w = out.shape[:2]
    bar = {"idle": (60, 60, 60), "judging": (160, 110, 0), "alarm": (0, 0, 200), "confirm": (0, 0, 200)}[gate.state]
    cv2.rectangle(out, (0, 0), (w, 56), bar, -1)
    top = gate.message
    if gate.state == "judging":
        top += f"  {max(0.0, gate.deadline - time.monotonic()):.1f}s"
    cv2.putText(out, top[:90], (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(out, f"GATE {gate.args.gate.upper()} | card: {gate.buffer}_ | Esc quit", (10, 46),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 230, 230), 1)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="보호구 게이트 판정")
    ap.add_argument("--gate", choices=["a", "b"], required=True)
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--model", help="모델 파일 (없으면 DB 배포 모델 → 004 기본 경로)")
    ap.add_argument("--seconds", type=float, default=3.0, help="판정 시간(초)")
    ap.add_argument("--ratio", type=float, default=0.6, help="착용/미착용으로 정하는 프레임 비율")
    ap.add_argument("--min-person", type=float, default=0.5, help="사람이 잡혀야 하는 프레임 비율")
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--goggles-conf", type=float, help=f"보안경 신뢰도 기준값 (기본 {THRESHOLDS['goggles']}). 안경 오인식이 있으면 올림")
    ap.add_argument("--helmet-conf", type=float, help=f"안전모 신뢰도 기준값 (기본 {THRESHOLDS['helmet']})")
    ap.add_argument("--no-db", action="store_true", help="DB 없이 판정만")
    ap.add_argument("--no-mirror", action="store_true")
    ap.add_argument("--env", default=str(HERE / ".env"))
    ap.add_argument("--no-stream", action="store_true", help="실시간 화면 송출 안 함")
    ap.add_argument("--stream-url", default="https://gknushift.freemyip.com/api/images/gate/{gate}/frame")
    ap.add_argument("--stream-fps", type=float, default=30, help="초당 송출 장수 (노트북 판정 속도보다 빠르면 그 속도만큼만 나감)")
    ap.add_argument("--stream-width", type=int, default=640, help="송출 화면 가로 크기(px)")
    args = ap.parse_args()
    if not 0 < args.ratio <= 1 or not 0 <= args.min_person <= 1 or args.seconds <= 0:
        ap.error("--ratio 0~1, --min-person 0~1, --seconds > 0")
    for name, value in (("goggles", args.goggles_conf), ("helmet", args.helmet_conf)):
        if value is not None:
            if not 0 < value <= 1:
                ap.error(f"--{name}-conf 는 0~1")
            THRESHOLDS[name] = value

    log("시작 — 설정 읽는 중")
    load_env(Path(args.env))
    load_env(HERE.parents[1] / ".env")   # IMAGE_API_KEY 는 저장소 루트 .env 에 있어도 됨 (이미 있는 값은 안 덮음)
    url = None if args.no_db else os.environ.get("DATABASE_URL")
    if not args.no_db and not url:
        raise SystemExit(f"[gate] {args.env} 에 DATABASE_URL 이 없습니다 (DB 없이 시험: --no-db)")
    db = Db(url)
    gate = Gate(args, db)

    model_path = args.model or db.deployed_model() or DEFAULT_MODEL
    if not Path(model_path).is_file():
        log(f"모델 파일 없음: {model_path} → 기본 경로 사용")
        model_path = DEFAULT_MODEL
    log(f"모델 불러오는 중 (처음엔 10~30초): {model_path}")
    import cv2
    import torch
    from ultralytics import YOLO
    device = 0 if torch.cuda.is_available() else "cpu"
    model = YOLO(model_path)
    names = model.names
    log(f"모델 {Path(model_path).name} · 장치 {device} · 게이트 {args.gate} 필수 {gate.rules[args.gate]} · DB {'없음' if args.no_db else '연결'}")
    log(f"기준값 안전모 {THRESHOLDS['helmet']} · 보안경 {THRESHOLDS['goggles']} · 판정 {args.seconds:g}초")

    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW) if sys.platform == "win32" else cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"[gate] 카메라 {args.camera} 를 열 수 없습니다 (--camera 1 시도)")
    conf = min(THRESHOLDS.values())
    key = os.environ.get("IMAGE_API_KEY", "").strip()
    streamer = None
    if args.no_stream or not key:
        log("실시간 화면 송출 안 함" + ("" if args.no_stream else " (.env 에 IMAGE_API_KEY 없음)"))
    else:
        streamer = Streamer(args.stream_url.format(gate=args.gate), key)
    next_push = 0.0
    log("준비 완료 — 'PPE gate' 카메라 창을 클릭한 뒤 카드 번호 입력 + Enter (콘솔에 입력하면 안 됨), Esc 종료")
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                raise SystemExit("[gate] 카메라 영상이 끊겼습니다")
            if not args.no_mirror:
                frame = cv2.flip(frame, 1)
            result = model.predict(frame, imgsz=args.imgsz, conf=conf, device=device, verbose=False)[0]
            if gate.state == "judging":
                gate.tally.add(observe(detections_of(result, names)))
                if time.monotonic() >= gate.deadline:
                    gate.finish()
            gate.beep()
            shown = draw(cv2, frame, result, names, gate)
            cv2.imshow("PPE gate", shown)
            if streamer is not None and time.monotonic() >= next_push:
                next_push = time.monotonic() + 1 / args.stream_fps
                h, w = shown.shape[:2]
                small = cv2.resize(shown, (args.stream_width, int(h * args.stream_width / w))) if w > args.stream_width else shown
                ok_jpg, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ok_jpg:
                    streamer.put(buf.tobytes())
            if not gate.key(cv2.waitKey(1) & 0xFF):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
