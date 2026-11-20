"""일일 공지용 관리도 알림 판정 — 프런트 common/casting/alerts.ts buildAlertCards 와 동일 규칙.

화면 알림 UI는 프런트 유지. 여기는 전날 샷 집계·LLM 요약용 (localStorage 닫힘과 무관).
자체 점검: uv run python -m casting.alerts_daily_check
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

Grade = Literal["alarm", "caution", "watch"]
Rule = Literal["alarm", "n1", "n2", "n3", "ewma", "mr"]
Dir = Literal["up", "down"] | None

GRADE_NAME: dict[Grade, str] = {"alarm": "경보", "caution": "주의", "watch": "관찰"}
GRADE_RANK: dict[Grade, int] = {"alarm": 3, "caution": 2, "watch": 1}

ALERT_KEYS = [
    "top_temp1", "top_temp2", "bottom_temp1", "bottom_temp2", "biscuit_thickness",
    "cooling_water_temp", "injection_pressure", "mechanical_strength", "sleeve_temperature",
    "mold_temperature", "molten_capacity", "facility_CycleTime", "production_CycleTime",
]

ALARMS = [
    {"key": "injection_pressure", "limit": 600, "cond": "600 미만", "hit": lambda v: v < 600},
    {"key": "mechanical_strength", "limit": 0, "cond": "0 이하", "hit": lambda v: v <= 0},
    {"key": "biscuit_thickness", "limit": 125, "cond": "125 이하", "hit": lambda v: v <= 125},
]

LAMBDA = 0.2
N2_LEN = 9
N3_LEN = 6
RELATED_WINDOW = 5
RULE_ORDER: list[Rule] = ["n1", "n2", "ewma", "n3", "mr"]
RULE_GRADE: dict[Rule, Grade] = {
    "alarm": "alarm", "n1": "caution", "n2": "watch", "n3": "watch", "ewma": "watch", "mr": "watch",
}

LABELS: dict[str, str] = {
    "injection_pressure": "주입 압력", "sleeve_temperature": "슬리브 온도",
    "top_temp1": "상금형온도 1", "top_temp2": "상금형온도 2", "top_temp3": "상금형온도 3",
    "bottom_temp1": "하금형온도 1", "bottom_temp2": "하금형온도 2", "bottom_temp3": "하금형온도 3",
    "cooling_water_temp": "냉각수 온도", "biscuit_thickness": "비스켓 두께", "mechanical_strength": "형체력",
    "mold_temperature": "용융온도", "molten_capacity": "용탕량",
    "facility_CycleTime": "설비 사이클 시간", "production_CycleTime": "생산 사이클 시간",
}

MOLD = ["top_temp1", "top_temp2", "bottom_temp1", "bottom_temp2"]
CYCLE = ["facility_CycleTime", "production_CycleTime"]
GROUP_OF = {
    "biscuit_thickness": "biscuit", "cooling_water_temp": "cooling", "injection_pressure": "injection",
    "mechanical_strength": "strength", "sleeve_temperature": "sleeve", "mold_temperature": "melt",
    "molten_capacity": "molten",
}

GUIDE: dict[str, dict[str, str]] = {
    "mold": {
        "n1-down": "{v} 낮음: 직전 정지·재가동 여부와 이형제 스프레이 양·시간을 확인하세요.",
        "n1-up": "{v} 높음: 해당 위치 냉각 채널 유량·막힘과 온조기 설정을 확인하세요.",
        "mean-down": "{v} 평균 하강: 온조기 히터 출력과 냉각수 유량 증가 여부를 확인하세요.",
        "mean-up": "{v} 평균 상승: 온조기·냉각수 설정 변경과 사이클 단축 여부를 확인하세요.",
        "n3-down": "{v} 계속 하강: 사이클 지연·대기 증가와 온조기 동작을 확인하세요.",
        "n3-up": "{v} 계속 상승: 냉각 채널 스케일 누적과 냉각수 공급 중단을 확인하세요.",
        "mr": "{v} 샷 간 흔들림: 열전대 고정·접촉 상태와 온조기 헌팅을 확인하세요.",
    },
    "biscuit": {
        "alarm": "비스켓 두께 한계 이하: 용탕 공급과 사출 동작을 점검하세요.",
        "n1-down": "비스켓 두께 낮음: 용탕 계량(래들) 정량과 보온로 수위를 확인하세요.",
        "n1-up": "비스켓 두께 높음: 래들 과다 계량과 플런저 스트로크를 확인하세요.",
        "mean-down": "비스켓 두께 평균 하강: 래들 계량 설정과 래들 내부 부착물을 확인하세요.",
        "mean-up": "비스켓 두께 평균 상승: 계량 설정 변경과 래들 계량 장치를 확인하세요.",
        "n3-down": "비스켓 두께 계속 하강: 래들 내부 산화물 부착이 늘고 있는지 확인하세요.",
        "n3-up": "비스켓 두께 계속 상승: 플런저 팁 마모와 슬리브 마찰을 확인하세요.",
        "mr": "비스켓 두께 샷 간 흔들림: 래들 계량 반복성(각도·타이밍)을 확인하세요.",
    },
    "cooling": {
        "n1-up": "냉각수 온도 높음: 칠러·쿨링타워 동작과 냉각수 유량을 확인하세요.",
        "n1-down": "냉각수 온도 낮음: 칠러 설정과 온도 센서를 확인하세요.",
        "mean-up": "냉각수 온도 평균 상승: 칠러 능력 저하, 열교환기 오염, 외기 온도를 확인하세요.",
        "mean-down": "냉각수 온도 평균 하강: 칠러 설정 변경 이력을 확인하세요.",
        "n3-up": "냉각수 온도 계속 상승: 칠러·냉각탑 팬 정지와 순환 펌프를 확인하세요.",
        "n3-down": "냉각수 온도 계속 하강: 샷 사이 대기가 길어져 열 부하가 줄었는지와 칠러 설정 변경을 확인하세요.",
        "mr": "냉각수 온도 샷 간 흔들림: 칠러 온도 제어 헌팅과 밸브 개폐 반복을 확인하세요.",
    },
    "injection": {
        "alarm": "{v} 한계 미달: 어큐뮬레이터와 유압 장치를 점검하세요.",
        "n1-down": "{v} 낮음: 어큐뮬레이터 질소 압력과 유압을 확인하세요.",
        "n1-up": "{v} 높음: 사출 설정 변경과 압력 센서를 확인하세요.",
        "mean-down": "{v} 평균 하강: 유압유 온도와 펌프·밸브 누설을 확인하세요.",
        "mean-up": "{v} 평균 상승: 사출 조건 설정 변경 이력을 확인하세요.",
        "n3-down": "{v} 계속 하강: 어큐뮬레이터 압력 저하와 유압 누유를 확인하세요.",
        "n3-up": "{v} 계속 상승: 유압유 온도 변화와 팁·슬리브 마찰을 확인하세요.",
        "mr": "{v} 샷 간 흔들림: 비례·서보 밸브 응답과 압력 센서를 확인하세요.",
    },
    "strength": {
        "alarm": "형체력 0: 금형이 잠기지 않았습니다. 형체 장치를 점검하세요.",
        "n1-down": "형체력 낮음: 금형 분할면 이물·버와 토글 윤활을 확인하세요.",
        "n1-up": "형체력 높음: 형체 설정과 형두께 조정을 확인하세요.",
        "mean-down": "형체력 평균 하강: 금형 온도 하락과 타이바 신장을 확인하세요.",
        "mean-up": "형체력 평균 상승: 금형 온도 상승(열팽창)과 형두께 조정을 확인하세요.",
        "n3-down": "형체력 계속 하강: 토글 링크·핀 마모와 타이바 너트 풀림을 확인하세요.",
        "n3-up": "형체력 계속 상승: 금형이 가열 중인지(재가동 직후) 확인하세요.",
        "mr": "형체력 샷 간 흔들림: 형체 유압과 형체력 센서를 확인하세요.",
    },
    "sleeve": {
        "n1-down": "슬리브 온도 낮음: 직전 대기·정지 여부와 슬리브 예열을 확인하세요.",
        "n1-up": "슬리브 온도 높음: 슬리브 냉각과 급탕 후 체류 시간을 확인하세요.",
        "mean-down": "슬리브 온도 평균 하강: 슬리브 냉각 유량 증가와 사이클 대기 증가를 확인하세요.",
        "mean-up": "슬리브 온도 평균 상승: 슬리브 냉각 부족과 용탕 온도 상승을 확인하세요.",
        "n3-down": "슬리브 온도 계속 하강: 샷 사이 대기 시간이 길어지고 있는지(급탕·취출 지연) 확인하세요.",
        "n3-up": "슬리브 온도 계속 상승: 재가동 후 예열 중인지, 냉각 회로 이상인지 확인하세요.",
        "mr": "슬리브 온도 샷 간 흔들림: 급탕 시점 불규칙과 온도 센서 접촉을 확인하세요.",
    },
    "melt": {
        "n1-down": "용융온도 낮음: 보온로 히터와 잉곳 투입 직후인지 확인하세요.",
        "n1-up": "용융온도 높음: 보온로 온도 설정과 과열을 확인하세요.",
        "mean-down": "용융온도 평균 하강: 보온로 히터 출력과 잉곳 투입 주기를 확인하세요.",
        "mean-up": "용융온도 평균 상승: 보온로 설정 변경 이력을 확인하세요.",
        "n3-down": "용융온도 계속 하강: 잉곳 연속 투입과 히터 고장을 확인하세요.",
        "n3-up": "용융온도 계속 상승: 온도 제어기 동작을 확인하세요.",
        "mr": "용융온도 샷 간 흔들림: 열전대 보호관 상태와 온도 제어기 헌팅을 확인하세요.",
    },
    "molten": {
        "n1-down": "용탕량 낮음: 래들 계량과 보온로 수위를 확인하세요.",
        "n1-up": "용탕량 높음: 래들 과다 계량과 계량 센서를 확인하세요.",
        "mean-up": "용탕량 평균 이동: 계량 설정 변경과 보온로 수위 변화를 확인하세요.",
        "mean-down": "용탕량 평균 이동: 계량 설정 변경과 보온로 수위 변화를 확인하세요.",
        "n3-down": "용탕량 계속 하강: 보온로 수위가 낮아지고 있는지, 용탕 보충 시점을 확인하세요.",
        "n3-up": "용탕량 계속 상승: 보충 직후 수위 상승과 계량 설정을 확인하세요.",
        "mr": "용탕량 샷 간 흔들림: 래들 계량 반복성을 확인하세요.",
    },
    "cycle": {
        "n1-up": "{v} 길어짐: 취출·스프레이·로봇 대기 등 지연 원인을 확인하세요.",
        "n1-down": "{v} 짧아짐: 사이클 설정 변경과 공정 단계 생략 여부를 확인하세요.",
        "mean-up": "{v} 평균 증가: 로봇·취출기 동작 지연과 작업 인원을 확인하세요.",
        "mean-down": "{v} 평균 단축: 냉각·스프레이 시간 설정 변경을 확인하세요.",
        "n3-up": "{v} 계속 증가: 지연이 누적되는 설비(취출, 스프레이)를 확인하세요.",
        "n3-down": "{v} 계속 단축: 사이클 설정 조정 중인지 확인하세요.",
        "mr": "{v} 불규칙: 짧은 정지 반복, 취출 실패, 작업자 대기를 확인하세요.",
    },
}

COMBOS: list[tuple[Callable, str]] = [
    (lambda h: h(["top_temp1", "top_temp2"], "down") and h(["bottom_temp1", "bottom_temp2"], "down") and h(CYCLE, "up"),
     "설비 지연으로 금형 온도 하락: 지연 원인을 확인하고 예열 샷을 검토하세요."),
    (lambda h: h(["mold_temperature"], "down") and h(["sleeve_temperature"], "down") and h(MOLD, "down"),
     "열 공급 부족: 보온로 온도부터 확인하세요."),
    (lambda h: h(["top_temp1"], "down") and h(["top_temp2"], "down"),
     "상형 전체 온도 하락: 직전 정지 여부와 상형 온조기를 확인하세요."),
    (lambda h: h(MOLD, "up") and h(["cooling_water_temp"], "up"),
     "냉각수 온도 상승으로 금형 과열: 칠러와 냉각수 유량을 확인하세요."),
    (lambda h: h(["biscuit_thickness"], "down") and h(["molten_capacity"], "down"),
     "용탕 공급 부족: 래들 계량과 보온로 수위를 확인하세요."),
    (lambda h: h(["injection_pressure"], "down") and h(["biscuit_thickness"], "up"),
     "사출 불완전: 어큐뮬레이터 압력과 플런저 동작을 확인하세요."),
    (lambda h: h(["mechanical_strength"], "up") and h(MOLD, "up"),
     "금형 온도 상승(형체력 동반): 금형 온도 원인부터 확인하세요."),
]

RELATED_PAIRS = [
    (["top_temp1"], ["top_temp2"]),
    (CYCLE, MOLD),
    (["cooling_water_temp"], MOLD),
    (["injection_pressure"], ["biscuit_thickness"]),
    (MOLD, ["mechanical_strength"]),
    (CYCLE, ["sleeve_temperature"]),
    (["mold_temperature"], ["sleeve_temperature", *MOLD]),
    (["molten_capacity"], ["biscuit_thickness"]),
]


def _group_of(k: str) -> str:
    if k in MOLD:
        return "mold"
    if k in CYCLE:
        return "cycle"
    return GROUP_OF[k]


def _signal_of(rule: Rule, direction: Dir) -> str:
    if rule in ("alarm", "mr"):
        return rule
    prefix = "n1" if rule == "n1" else ("n3" if rule == "n3" else "mean")
    return f"{prefix}-{'up' if direction == 'up' else 'down'}"


def _related(a: str, b: str) -> bool:
    for x, y in RELATED_PAIRS:
        if (a in x and b in y) or (b in x and a in y):
            return True
    return False


def _invalid(k: str, v: float | None) -> bool:
    if v is None:
        return True
    try:
        if v != v:  # NaN
            return True
    except Exception:
        return True
    if k == "mold_temperature" and v == 0:
        return True
    if k == "molten_capacity" and (v == 0 or v > 100):
        return True
    return False


def _fv(v: float, sigma: float) -> str:
    return f"{v:.2f}" if sigma < 1 else f"{v:.1f}"


def _plain(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else f"{v:.1f}"


def _hhmm(t: str) -> str:
    parts = t.split(":")
    h, m = parts[0], parts[1] if len(parts) > 1 else "00"
    return f"{int(h):02d}:{m}"


def _phenomenon(rule: Rule, direction: Dir) -> str:
    if rule == "n1":
        return f"정상 범위 이탈 ({'높음' if direction == 'up' else '낮음'})"
    if rule == "n2":
        return f"평균 이동 ({'높은 쪽' if direction == 'up' else '낮은 쪽'}, {N2_LEN}샷)"
    if rule == "n3":
        return f"연속 {'상승' if direction == 'up' else '하강'} ({N3_LEN}샷)"
    if rule == "ewma":
        return f"수준 서서히 {'상승' if direction == 'up' else '하강'}"
    return "샷 간 흔들림"


def _same_side(recent: list[float], cl: float, n: int) -> Dir:
    if len(recent) < n:
        return None
    last = recent[-n:]
    if all(x > cl for x in last):
        return "up"
    if all(x < cl for x in last):
        return "down"
    return None


def _monotone(recent: list[float], n: int) -> Dir:
    if len(recent) < n:
        return None
    last = recent[-n:]
    diffs = [last[i + 1] - last[i] for i in range(n - 1)]
    if all(d > 0 for d in diffs):
        return "up"
    if all(d < 0 for d in diffs):
        return "down"
    return None


@dataclass
class VarState:
    e: float = 0.0
    x_prev: float | None = None
    recent: list[float] = field(default_factory=list)
    active: dict[str, bool] = field(default_factory=lambda: {
        "n1": False, "n2": False, "n3": False, "ewma": False, "mr": False,
    })


@dataclass
class VarAlert:
    key: str
    rule: Rule
    grade: Grade
    dir: Dir
    z: float
    title: str
    detail: str


@dataclass
class AlertCard:
    id: str
    line: str
    date: str
    time: str
    shot_id: int
    grade: Grade
    head: str
    title: str
    details: list[str]
    guide: str
    extra: str | None
    vars: list[VarAlert]


def build_alert_cards(
    shots: list[dict[str, Any]],
    limits: dict[str, Any],
    date: str,
    labels: dict[str, str] | None = None,
) -> list[AlertCard]:
    """샷 목록(시각 순) → 알림 카드. limits = casting.spc.limits(line) 형식."""
    if date < limits["judgeFrom"]:
        return []
    labels = labels or LABELS
    line = limits["line"]
    lim: dict[str, dict] = limits.get("variables") or {}
    keys = [k for k in ALERT_KEYS if lim.get(k)]
    label = lambda k: labels.get(k, k)

    state: dict[str, VarState] = {}
    history: list[dict[str, Any]] = []
    prev_count: int | None = None
    cards: list[AlertCard] = []

    for shot in shots:
        shot_id = int(shot["shotId"])
        if prev_count is not None and shot_id < prev_count:
            state = {}
            history = []
        prev_count = shot_id
        f = shot.get("features") or {}
        hits: list[VarAlert] = []

        alarms = [a for a in ALARMS if f.get(a["key"]) is not None and a["hit"](f[a["key"]])]
        if alarms:
            for a in alarms:
                v = f[a["key"]]
                l = lim.get(a["key"])
                z = ((v - l["cl"]) / l["sigma"]) if l else 0.0
                hits.append(VarAlert(
                    key=a["key"], rule="alarm", grade="alarm", dir="down", z=z,
                    title=f"{label(a['key'])} 설비 한계 이탈 ({a['cond']})",
                    detail=f"{label(a['key'])} {_plain(v)} (한계 {a['limit']})",
                ))
        else:
            for k in keys:
                x = f.get(k)
                if _invalid(k, x):
                    continue
                l = lim[k]
                s = state.setdefault(k, VarState())
                d = x - l["cl"]
                z = d / l["sigma"]
                s.e = LAMBDA * d + (1 - LAMBDA) * s.e
                s.recent.append(x)
                if len(s.recent) > N2_LEN:
                    s.recent.pop(0)
                ewma = l["cl"] + s.e
                diff = None if s.x_prev is None else abs(x - s.x_prev)
                n2 = _same_side(s.recent, l["cl"], N2_LEN)
                n3 = _monotone(s.recent, N3_LEN)
                now = {
                    "n1": x > l["iUcl"] or x < l["iLcl"],
                    "n2": n2 is not None,
                    "n3": n3 is not None,
                    "ewma": ewma > l["ewmaUcl"] or ewma < l["ewmaLcl"],
                    "mr": diff is not None and diff > l["mrUcl"],
                }
                s.x_prev = x
                fresh = [r for r in RULE_ORDER if now[r] and not s.active[r]]
                s.active = now
                if not fresh:
                    continue
                rule = fresh[0]
                if rule == "n1":
                    direction: Dir = "up" if z > 0 else "down"
                elif rule == "n2":
                    direction = n2
                elif rule == "n3":
                    direction = n3
                elif rule == "ewma":
                    direction = "up" if s.e > 0 else "down"
                else:
                    direction = None
                if rule == "ewma":
                    detail = (
                        f"{label(k)} EWMA {_fv(ewma, l['sigma'])} "
                        f"(관리선 {_fv(l['ewmaLcl'], l['sigma'])} ~ {_fv(l['ewmaUcl'], l['sigma'])})"
                    )
                elif rule == "mr":
                    detail = f"{label(k)} 차이 {_fv(diff, l['sigma'])} (상한 {_fv(l['mrUcl'], l['sigma'])})"
                else:
                    detail = (
                        f"{label(k)} {_fv(x, l['sigma'])} "
                        f"(관리선 {_fv(l['iLcl'], l['sigma'])} ~ {_fv(l['iUcl'], l['sigma'])})"
                    )
                hits.append(VarAlert(
                    key=k, rule=rule, grade=RULE_GRADE[rule], dir=direction, z=z,
                    title=f"{label(k)} {_phenomenon(rule, direction)}", detail=detail,
                ))

        if not hits:
            continue

        hits.sort(key=lambda h: (-GRADE_RANK[h.grade], -abs(h.z)))
        top = hits[0]
        guide_tpl = GUIDE.get(_group_of(top.key), {}).get(_signal_of(top.rule, top.dir), "")
        guide = guide_tpl.replace("{v}", label(top.key))

        def has(ks: list[str], direction: str) -> bool:
            return any(h.key in ks and h.dir == direction for h in hits)

        extra = next((text for test, text in COMBOS if test(has)), None)
        if not extra:
            recent = [
                h for h in history
                if 0 < shot_id - h["shotId"] <= RELATED_WINDOW
                and any(_related(x.key, h["key"]) for x in hits)
            ][-2:][::-1]
            if recent:
                extra = "최근 관련 알림: " + " · ".join(
                    f"#{h['shotId']} {h['title']}, {shot_id - h['shotId']}샷 전" for h in recent
                )

        for h in hits:
            history.append({"shotId": shot_id, "key": h.key, "title": h.title})
        history = [h for h in history if shot_id - h["shotId"] < RELATED_WINDOW]

        casting_id = shot.get("castingId") or f"{shot.get('time', '')}#{shot_id}"
        cards.append(AlertCard(
            id=f"{line}|{date}|{casting_id}",
            line=line, date=date, time=str(shot.get("time", "")), shot_id=shot_id,
            grade=top.grade,
            head=f"{GRADE_NAME[top.grade]} · {date} {_hhmm(str(shot.get('time', '0:00')))} · {line} · #{shot_id}",
            title=f"#{shot_id} {top.title}" + (f" 외 {len(hits) - 1}건" if len(hits) > 1 else ""),
            details=[h.detail for h in hits], guide=guide, extra=extra, vars=hits,
        ))
    return cards


def summarize_stats(cards: list[AlertCard]) -> dict[str, Any]:
    """등급·라인별 건수."""
    by_grade = {"alarm": 0, "caution": 0, "watch": 0}
    by_line: dict[str, dict[str, int]] = {}
    for c in cards:
        by_grade[c.grade] = by_grade.get(c.grade, 0) + 1
        line = by_line.setdefault(c.line, {"alarm": 0, "caution": 0, "watch": 0})
        line[c.grade] = line.get(c.grade, 0) + 1
    return {"total": len(cards), "by_grade": by_grade, "by_line": by_line}
