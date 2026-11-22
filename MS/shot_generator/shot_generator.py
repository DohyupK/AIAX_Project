r"""실시간 샷 생성기 — TM 「시연 데이터 생성 규칙 (실시간용)」 규칙 1~6 (2026-11-20, MS)

값 목록: shot_params.json (shot_params.py 로 원본에서 추출). 설비(line_no1~3)마다 따로, 서로 영향 없음.
샷만 만듦. 이미지는 따로 (MS/db/apps 의 apps.image_sender — mes 에 들어온 양품 샷에 사진을 붙임).
서버(우분투)에서 상시 실행 → mes.investment_casting 에 바로 저장 (Kafka 안 거침).
이 폴더(shot_generator.py + shot_params.json) 하나만 있으면 돌아감. 설명: 같은 폴더 README.md
실행: python shot_generator.py --mode …

모드
  fast : 기다리지 않고 바로 만들어 CSV 저장 + 규칙 검증표. DB 안 씀
         예) --mode fast --shots 20000 --out fast.csv
  test : 지금 시각부터 샷 시각이 되면 화면에만 출력. DB 안 씀
         예) --mode test --speed 20   (20배속으로 빨리 보기)
  run  : 운영. DB 의 라인별 마지막 샷에서 이어서, 샷 시각이 되면 mes 에 저장
         꺼져 있던 동안의 샷은 다시 켜질 때 한꺼번에 채움. DB 가 끊기면 같은 샷을 계속 다시 시도
         --speed 로 배속(기본 1, 시연 20). 배속>1 이면 사이클·샷간격 ÷speed(~150/20),
         INSERT 시각은 벽시계로 찍어 live 조회에 보이게 함. (배속용 별도 표·API 없음)
         --table 로 시험 테이블에 넣어 볼 수 있음 (예: mes.investment_casting_test, 같은 구조)
설정: 환경변수 또는 .env 파일 (--env 로 지정, 없으면 이 폴더의 .env → 위쪽 폴더의 .env 순서로 찾음)
  DATABASE_URL = app_mes 계정 (mes 읽기·쓰기)
"""
from __future__ import annotations

import argparse
import bisect
import csv
import json
import math
import os
import random
import re
import signal
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

try:
    from zoneinfo import ZoneInfo
    KST = ZoneInfo("Asia/Seoul")
except Exception:  # Windows 에 tzdata 가 없을 때 — 한국은 서머타임이 없어 UTC+9 고정
    KST = timezone(timedelta(hours=9), "KST")

PARAMS = Path(__file__).with_name("shot_params.json")
HERE = Path(__file__).resolve().parent
LINES = ["line_no1", "line_no2", "line_no3"]
DB_COLS = ["line_unit", "production", "timestamp", "date", "production_count", "mold_temperature",
           "facility_cycletime", "production_cycletime", "mechanical_strength", "molten_capacity",
           "injection_pressure", "sleeve_temperature", "top_temp1", "top_temp2", "top_temp3", "top_temp4",
           "bottom_temp1", "bottom_temp2", "bottom_temp3", "bottom_temp4", "biscuit_thickness",
           "cooling_water_temp", "passorfail"]
# 출력 칼럼 (원본 이름·순서 그대로)
OUT_COLS = ["line_unit", "production", "timestamp", "date", "production_count", "mold_temperature",
            "facility_CycleTime", "production_CycleTime", "mechanical_strength", "molten_capacity",
            "injection_pressure", "sleeve_temperature", "top_temp1", "top_temp2", "top_temp3", "top_temp4",
            "bottom_temp1", "bottom_temp2", "bottom_temp3", "bottom_temp4", "biscuit_thickness",
            "cooling_water_temp", "PassOrFail"]


def log(msg: str) -> None:
    print(f"[shot_generator {datetime.now(KST):%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def load_env(path: str | None = None) -> None:
    """환경변수가 먼저, 없는 값만 .env 에서"""
    if path:
        f = Path(path)
    else:   # 이 폴더 → 위쪽 폴더 순서로 처음 나오는 .env (저장소에서 돌리면 루트 .env)
        f = next((d / ".env" for d in (HERE, *HERE.parents) if (d / ".env").is_file()), None)
    if f is not None and f.exists():
        try:
            text = f.read_text(encoding="utf-8")
        except OSError:   # systemd(DynamicUser)는 .env 를 못 읽음 — 값은 EnvironmentFile 로 이미 들어옴
            return
        for line in text.splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def phi(z: np.ndarray) -> np.ndarray:
    """표준정규 누적분포"""
    return 0.5 * (1 + np.vectorize(math.erf)(z / math.sqrt(2)))


class Model:
    """규칙 2~6 — 샷 값과 불량 정하기"""

    def __init__(self, p: dict, rng: random.Random, nrng: np.random.Generator):
        self.p, self.r, self.rng, self.nrng = p, p["rules"], rng, nrng
        self.vars = p["vars"]
        c = np.array(p["corr"], dtype=float)
        w, v = np.linalg.eigh(c)                         # 반올림된 상관 행렬이 양의 정부호가 아닐 때 대비
        c = v @ np.diag(np.clip(w, 1e-6, None)) @ v.T
        d = np.sqrt(np.diag(c)); c = c / np.outer(d, d)
        self.chol = np.linalg.cholesky(c)
        self.cdf = {}
        for k, dv in p["dists"].items():
            cnt = np.cumsum(dv["counts"]); self.cdf[k] = (dv["values"], (cnt / cnt[-1]).tolist())

    def _pick(self, var: str, u: float) -> int:
        """원본 값 분포에서 아래쪽부터 비율 u 에 해당하는 값 (원본에 있던 값만 나옴)"""
        vals, cum = self.cdf[var]
        return int(vals[min(bisect.bisect_left(cum, u), len(vals) - 1)])

    def _choice(self, d: dict) -> int:
        return self.rng.choices(d["values"], weights=d["probs"])[0]

    def normal_values(self) -> dict:
        """규칙 3: 가우시안 코퓰러 — 상관 맞춘 표준정규 12개 → Φ → 원본 분포 분위"""
        u = phi(self.chol @ self.nrng.standard_normal(len(self.vars)))
        return {v: self._pick(v, float(ui)) for v, ui in zip(self.vars, u)}

    def alarm_values(self, kind: str) -> dict:
        """규칙 2: 원본 경보 샷 한 행 그대로 (용탕량이 빈 값·0 이하·100 초과면 분포에서 다시)"""
        row = dict(zip(self.vars, self.rng.choice(self.p["alarm_under" if kind == "under" else "alarm_other"])))
        m = row["molten_capacity"]
        if m is None or m <= 0 or m > 100:
            row["molten_capacity"] = self._pick("molten_capacity", self.rng.random())
        return row

    def derived(self, v: dict) -> dict:
        """규칙 4: 계산 칼럼"""
        v["facility_cycletime"] = v["production_cycletime"] - self._choice(self.r["facility_diff"])
        v["top_temp3"] = v["top_temp2"] * 3 + self._choice(self.r["top3_diff"])
        v["bottom_temp3"] = v["bottom_temp2"] * 3
        v["top_temp4"], v["bottom_temp4"] = self.r["top_temp4"], self.r["bottom_temp4"]
        return v

    def sensor_error(self, v: dict) -> None:
        """규칙 5: 정상 샷에만"""
        x = self.rng.random(); acc = 0.0
        for prob, val in self.r["sensor_error"]:
            acc += prob
            if x < acc:
                v["molten_capacity"] = val
                return

    def defect_prob(self, v: dict, alarm: bool, prev_fail: int) -> float:
        """규칙 6"""
        if alarm:
            return self.r["p_alarm_defect"]
        s = self.r["logit_base"] + self.r["logit_offset"] + self.r["logit_prev_fail"] * prev_fail
        for var, (bounds, coefs) in self.r["bins"].items():
            k = bisect.bisect_left(bounds, v[var])     # 값 ≤ 첫 경계 → 0번 구간, 경계 < 값 ≤ 다음 경계 → 다음 구간
            if k > 0:
                s += coefs[k - 1]
        return 1 / (1 + math.exp(-s))


@dataclass
class Line:
    """설비 하나의 상태 (런·시각·앞 샷 이어짐)"""
    name: str
    t: datetime                      # 마지막 샷 시각 (KST, 시간대 없음)
    count: int = 0                   # 런 안 샷 번호 (0 = 새 런 시작 전)
    run_end: datetime | None = None
    under_streak: int = 0
    prev_fail: int = 0
    stats: dict = field(default_factory=dict)


class Generator:
    def __init__(self, p: dict, seed: int | None):
        self.rng = random.Random(seed)
        self.model = Model(p, self.rng, np.random.default_rng(seed))
        self.p = p
        self.speed = 1.0   # 시연 배속 — 시각 진행·사이클 저장값 ÷speed (1이면 원본)

    def new_run(self, ln: Line, min_hours: float = 0.0) -> None:
        """규칙 1: 런 끝 → 정지 시간 → 새 런 (런 길이는 원본 62개 중 하나)"""
        ln.t += timedelta(seconds=self.rng.choice(self.p["stop_seconds"]) / self.speed)
        hours = [h for h in self.p["run_hours"] if h > min_hours] or self.p["run_hours"]
        ln.run_end = ln.t + timedelta(hours=self.rng.choice(hours) / self.speed)
        ln.count = 0

    def next_shot(self, ln: Line) -> dict:
        m, r = self.model, self.model.r
        first = False
        if ln.run_end is None or ln.t >= ln.run_end:
            self.new_run(ln); first = True
        # 규칙 2: 샷 종류 (압력 미달은 이어지고, 런이 바뀌어도 이어짐)
        p_under = r["p_under_after_under"] if ln.under_streak > 0 else r["p_under"]
        if ln.under_streak < r["max_under_run"] and self.rng.random() < p_under:
            kind = "under"
        elif self.rng.random() < r["p_other_alarm"]:
            kind = "other"
        else:
            kind = "normal"
        v = m.normal_values() if kind == "normal" else m.alarm_values(kind)
        v = m.derived(v)
        if kind == "normal":
            m.sensor_error(v)
        ln.under_streak = ln.under_streak + 1 if kind == "under" else 0
        fail = int(self.rng.random() < m.defect_prob(v, kind != "normal", ln.prev_fail))
        ln.prev_fail = fail
        # 시연 배속: 사이클 값·샷 간격 모두 ÷speed (×20 → ~150/20≈7.5초)
        sp = self.speed if self.speed > 0 else 1.0
        prod_ct = v["production_cycletime"] / sp
        fac_ct = v["facility_cycletime"] / sp
        # 규칙 1: 시각 — 런 첫 샷은 정지가 끝난 시각, 그 뒤는 앞 샷 + 이번 생산 사이클(배속 반영)
        if not first:
            ln.t += timedelta(seconds=prod_ct)
        ln.count += 1
        shot = {"line_unit": ln.name, "production": "CylinderHead", "timestamp": ln.t.strftime("%Y-%m-%d"),
                "date": f"{ln.t.hour}:{ln.t:%M:%S}", "production_count": ln.count,
                "mold_temperature": v["mold_temperature"], "facility_CycleTime": fac_ct,
                "production_CycleTime": prod_ct, "mechanical_strength": v["mechanical_strength"],
                "molten_capacity": v["molten_capacity"], "injection_pressure": v["injection_pressure"],
                "sleeve_temperature": v["sleeve_temperature"], "top_temp1": v["top_temp1"], "top_temp2": v["top_temp2"],
                "top_temp3": v["top_temp3"], "top_temp4": v["top_temp4"], "bottom_temp1": v["bottom_temp1"],
                "bottom_temp2": v["bottom_temp2"], "bottom_temp3": v["bottom_temp3"], "bottom_temp4": v["bottom_temp4"],
                "biscuit_thickness": v["biscuit_thickness"], "cooling_water_temp": v["cooling_water_temp"],
                "PassOrFail": fail}
        shot["_kind"] = kind
        return shot


def casting_id(s: dict) -> str:
    """DB 가 만드는 casting_id 와 같은 규칙 (L라인번호_yymmdd_hhmmss_생산번호)"""
    t = datetime.strptime(f"{s['timestamp']} {s['date']}", "%Y-%m-%d %H:%M:%S")
    return f"L{s['line_unit'].replace('line_no', '')}_{t:%y%m%d_%H%M%S}_{s['production_count']}"


# ---------------------------------------------------------------- fast 모드 (검증)
def report(shots: list[dict], p: dict) -> None:
    """문서 「규칙대로 만들었을 때 나오는 값」 과 비교"""
    print("\n항목                         문서(원본)      만든 데이터")
    for ln in LINES:
        s = [x for x in shots if x["line_unit"] == ln]
        if not s:
            continue
        kinds = [x["_kind"] for x in s]; fails = [x["PassOrFail"] for x in s]
        under = [k == "under" for k in kinds]
        after_under = [under[i] for i in range(1, len(s)) if under[i - 1]]
        streak, mx = 0, 0
        for u in under:
            streak = streak + 1 if u else 0; mx = max(mx, streak)
        alarm = [k != "normal" for k in kinds]
        nf = [f for f, a in zip(fails, alarm) if not a]
        nf_after = [fails[i] for i in range(1, len(s)) if not alarm[i] and fails[i - 1]]
        t0 = datetime.strptime(f"{s[0]['timestamp']} {s[0]['date']}", "%Y-%m-%d %H:%M:%S")
        t1 = datetime.strptime(f"{s[-1]['timestamp']} {s[-1]['date']}", "%Y-%m-%d %H:%M:%S")
        diff = {x["production_CycleTime"] - x["facility_CycleTime"] for x in s}
        pct = lambda a: f"{100 * sum(a) / max(len(a), 1):.2f}%"
        print(f"── {ln} ({len(s):,}샷)")
        print(f"  압력 미달 비율              2.84%          {pct(under)}")
        print(f"  미달 다음 샷도 미달          51%            {pct(after_under)}")
        print(f"  미달 최대 연속               8샷            {mx}샷")
        print(f"  경보 샷 비율                2.92%          {pct(alarm)}")
        print(f"  경보 샷 불량률              99.5%          {pct([f for f, a in zip(fails, alarm) if a])}")
        print(f"  정상 샷 불량률              1.58%          {pct(nf)}")
        print(f"  앞 샷 불량 뒤 정상 샷 불량률  24.3%          {pct(nf_after)}")
        print(f"  전체 불량률                 4.4%           {pct(fails)}")
        print(f"  시간당 샷 수                23.7           {len(s) / ((t1 - t0).total_seconds() / 3600):.1f}")
        print(f"  생산 − 설비 사이클           1~9초          {min(diff)}~{max(diff)}초")
        print(f"  하형3 = 하형2 × 3           100%           {pct([x['bottom_temp3'] == x['bottom_temp2'] * 3 for x in s])}")
    normal = [x for x in shots if x["_kind"] == "normal"]
    print("\n정상 샷 평균 / 표준편차 (원본 → 만든 데이터)")
    for v in p["vars"]:
        dv = p["dists"][v]; vals = np.repeat(dv["values"], dv["counts"])
        key = {"production_cycletime": "production_CycleTime"}.get(v, v)
        g = np.array([x[key] for x in normal if not (v == "molten_capacity" and x[key] in (0, 653))], dtype=float)
        print(f"  {v:22} {vals.mean():7.1f} / {vals.std():5.1f}  →  {g.mean():7.1f} / {g.std():5.1f}")


def run_fast(gen: Generator, n: int, out: str | None, start: datetime) -> None:
    shots = []
    for ln_name in LINES:
        ln = Line(ln_name, start)
        shots += [gen.next_shot(ln) for _ in range(n)]
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=OUT_COLS, extrasaction="ignore"); w.writeheader(); w.writerows(shots)
        log(f"저장: {out} ({len(shots):,}샷)")
    report(shots, gen.p)


# ---------------------------------------------------------------- test / run 모드
def last_shots(conn, table: str) -> dict[str, dict]:
    """운영 모드 시작점 — 라인별 마지막 샷과 런 시작 시각. 샷이 없는 라인은 빠짐"""
    out = {}
    for ln in LINES:
        rows = conn.execute(
            f'SELECT "timestamp", date, production_count, passorfail, injection_pressure '
            f'FROM {table} WHERE line_unit = %s '
            f'ORDER BY "timestamp" DESC, date DESC, production_count DESC LIMIT 20', (ln,)).fetchall()
        if not rows:
            continue
        last = rows[0]
        start = conn.execute(
            f'SELECT "timestamp", date FROM {table} WHERE line_unit = %s AND production_count = 1 '
            f'ORDER BY "timestamp" DESC, date DESC LIMIT 1', (ln,)).fetchone()
        streak = 0
        for r in rows:
            if r[4] is not None and r[4] < 600:
                streak += 1
            else:
                break
        out[ln] = {"t": datetime.combine(last[0], last[1]), "count": last[2], "prev_fail": int(last[3] or 0),
                   "streak": streak, "run_start": datetime.combine(start[0], start[1]) if start else None}
    return out


class Db:
    """mes 저장 — 끊기면 다시 연결해서 같은 샷을 계속 다시 시도"""
    RETRY = 10

    def __init__(self, url: str, table: str):
        self.url, self.table, self.conn = url, table, None
        cols = ", ".join(f'"{c}"' for c in DB_COLS)
        self.sql = (f"INSERT INTO {table} ({cols}) VALUES ({', '.join(['%s'] * len(DB_COLS))}) "
                    f"ON CONFLICT (casting_id) DO NOTHING")

    def connect(self):
        if self.conn is None or self.conn.closed:
            import psycopg
            self.conn = psycopg.connect(self.url, connect_timeout=15, autocommit=True)
        return self.conn

    def close(self) -> None:
        try:
            if self.conn is not None:
                self.conn.close()
        except Exception:
            pass
        self.conn = None

    def insert(self, shot: dict) -> bool:
        """저장되면 True, 이미 있던 casting_id 면 False"""
        t = datetime.strptime(f"{shot['timestamp']} {shot['date']}", "%Y-%m-%d %H:%M:%S")
        vals = [shot[k] for k in OUT_COLS]
        vals[2], vals[3] = t.date(), t.time()
        while True:
            try:
                return self.connect().execute(self.sql, vals).rowcount == 1
            except Exception as e:
                log(f"DB 저장 실패, {self.RETRY}초 뒤 다시: {str(e).strip().splitlines()[0]}")
                self.close()
                time.sleep(self.RETRY)

def _stamp_wall(shot: dict) -> dict:
    """배속 INSERT 시 live(date<=now)에 보이도록 시각만 벽시계로 바꿈 (사이클 값은 이미 ÷speed)"""
    now = datetime.now(KST).replace(tzinfo=None)
    out = dict(shot)
    out["timestamp"] = now.strftime("%Y-%m-%d")
    out["date"] = f"{now.hour}:{now:%M:%S}"
    return out


def run_stream(gen: Generator, mode: str, speed: float, max_shots: int | None, table: str) -> None:
    now = datetime.now(KST).replace(tzinfo=None)
    db = None
    lines: dict[str, Line] = {}
    if mode == "run":
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise SystemExit("[shot_generator] DATABASE_URL 이 없습니다 (app_mes 계정).")
        db = Db(url, table)
        while True:
            try:
                last = last_shots(db.connect(), table)
                break
            except Exception as e:
                log(f"DB 연결 실패, {Db.RETRY}초 뒤 다시: {str(e).strip().splitlines()[0]}")
                db.close()
                time.sleep(Db.RETRY)
        for name in LINES:
            s = last.get(name)
            if s is None:   # 빈 테이블(시험 테이블 등) — 지금부터 새 런
                lines[name] = Line(name, now - timedelta(seconds=gen.rng.randint(0, 150)))
                log(f"{name} 샷 없음 — 지금부터 시작")
                continue
            ln = Line(name, s["t"], count=s["count"], under_streak=s["streak"], prev_fail=s["prev_fail"])
            # 진행 중인 런을 이어감: 남은 길이는 지금까지 진행한 시간보다 긴 원본 런 길이에서 고름
            done_h = (s["t"] - s["run_start"]).total_seconds() / 3600 if s["run_start"] else 0
            longer = [h for h in gen.p["run_hours"] if h > done_h]
            ln.run_end = (s["run_start"] + timedelta(hours=gen.rng.choice(longer))) if (longer and s["run_start"]) else s["t"]
            lines[name] = ln
            gap = (now - s["t"]).total_seconds() / 60
            log(f"{name} 이어서 시작: 마지막 샷 {s['t']} #{s['count']} (런 진행 {done_h:.1f}시간"
                + (f", 밀린 {gap:.0f}분은 바로 채움)" if gap > 3 else ")"))
    else:
        for name in LINES:
            lines[name] = Line(name, now - timedelta(seconds=gen.rng.randint(0, 150)))   # 설비마다 시작 시점 다르게
    gen.speed = speed
    log(f"모드={mode} 저장={table if db else '안 함(화면 출력)'} 배속={speed}")

    pending = {name: gen.next_shot(ln) for name, ln in lines.items()}
    start_wall, start_sim = time.monotonic(), now
    sent = dup = 0
    try:
        while max_shots is None or sent < max_shots:
            name = min(pending, key=lambda k: lines[k].t)          # 가장 이른 샷부터
            shot = pending[name]
            due = lines[name].t
            # due 가 이미 ÷speed 압축됨 → wait 에서 speed 로 또 나누지 않음
            wait = (due - start_sim).total_seconds() - (time.monotonic() - start_wall)
            if wait > 0:
                time.sleep(wait)
            body = {k: v for k, v in shot.items() if not k.startswith("_")}
            # 배속>1: DB 시각은 벽시계로 찍어 /live 가 받게 함 (사이클 값은 이미 ÷speed)
            if mode == "run" and speed != 1.0:
                body = _stamp_wall(body)
            cid = casting_id(body)
            if db is None or db.insert(body):
                sent += 1
                log(f"샷 {cid} {shot['_kind']} PassOrFail={body['PassOrFail']} "
                    f"cycle={body['production_CycleTime']:.1f}s ×{speed:g}")
            else:
                dup += 1
                log(f"샷 {cid} 이미 있음 — 건너뜀")
            pending[name] = gen.next_shot(lines[name])
    except KeyboardInterrupt:
        log("중지")
    finally:
        if db is not None:
            db.close()
        log(f"저장한 샷 {sent}" + (f", 중복 건너뜀 {dup}" if dup else ""))


def _stop(_sig, _frm):
    raise KeyboardInterrupt   # systemctl stop (SIGTERM) 도 Ctrl+C 처럼 정리하고 끝냄


def main() -> None:
    ap = argparse.ArgumentParser(description="실시간 샷 생성기 (TM 규칙)")
    ap.add_argument("--mode", choices=["fast", "test", "run"], required=True)
    ap.add_argument("--shots", type=int, help="fast: 라인별 샷 수(기본 20000) / test·run: 만들 샷 수 상한(없으면 계속)")
    ap.add_argument("--out", help="fast: CSV 저장 경로")
    ap.add_argument("--speed", type=float, default=1.0, help="배속 (test·run). 시연은 20")
    ap.add_argument("--table", default="mes.investment_casting", help="run: 저장할 테이블")
    ap.add_argument("--env", help=".env 파일 경로 (없으면 저장소 루트 .env)")
    ap.add_argument("--seed", type=int)
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z_]+\.[a-z_]+", a.table):
        ap.error("--table 은 스키마.테이블 형식 (예: mes.investment_casting_test)")
    if a.speed <= 0:
        ap.error("--speed 는 0보다 커야 합니다")
    load_env(a.env)
    signal.signal(signal.SIGTERM, _stop)
    if not PARAMS.exists():
        raise SystemExit(f"[shot_generator] {PARAMS.name} 가 없습니다. 같은 폴더에 있어야 합니다 (만들기: python shot_params.py)")
    gen = Generator(json.loads(PARAMS.read_text(encoding="utf-8")), a.seed)
    if a.mode == "fast":
        run_fast(gen, a.shots or 20000, a.out, datetime(2026, 11, 21, 0, 0))
        return
    run_stream(gen, a.mode, a.speed, a.shots, a.table)


if __name__ == "__main__":
    main()
