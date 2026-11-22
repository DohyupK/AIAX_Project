"""관리도 계산 자체 점검 — 실행: cd JH/api && uv run python -m casting.spc_check"""
import datetime as dt

from casting import spc

# 1) 기준선 표 39줄이 공식과 맞는지 (반올림 오차 0.05 이내) — 옮겨 적다 틀린 숫자 잡기
w = 3 * (spc.LAMBDA / (2 - spc.LAMBDA)) ** 0.5   # EWMA 폭 = 1σ
n = 0
for line, table in spc._TABLE.items():
    for key in table:
        b = spc.baseline(line, key)
        for got, want, what in ((b["iUcl"], b["cl"] + 3 * b["sigma"], "I UCL"), (b["iLcl"], b["cl"] - 3 * b["sigma"], "I LCL"),
                                (b["mrUcl"], 3.267 * b["mrCl"], "MR UCL"), (b["sigma"], b["mrCl"] / 1.128, "σ = MR̄/d2"),
                                (b["ewmaUcl"], b["cl"] + w * b["sigma"], "EWMA UCL"), (b["ewmaLcl"], b["cl"] - w * b["sigma"], "EWMA LCL")):
            assert abs(got - want) <= 0.05, f"{line} {key} {what}: {got} ≠ {want:.2f}"
        n += 1
assert n == 39 and spc.baseline("line_no1", "top_temp3") is None and spc.baseline("line_no9", "top_temp1") is None

# 2) 생산 흐름 나누기
assert spc.split_flows([1, 2, 3, 4, 5, 1, 2, 3]) == [0] * 8                      # 한 흐름의 재가동 → 흐름 1개
assert spc.split_flows([10, 1, 11, 2, 12, 3, 13]) == [0, 1, 0, 1, 0, 1, 0]       # 두 흐름 번갈아 → 2개
assert spc.split_flows([5, 6, 7, 1, 2, 3]) == [0] * 6                            # 앞 흐름이 멈춘 뒤 1 → 같은 흐름 재가동

# 3) 넬슨 2·3 (화면에 있던 규칙과 같음)
assert all(2 in f for f in spc.nelson_23([1, 2, 1, 2, 1, 2, 1, 2, 1, -1], 0)[:9])
assert not any(2 in f for f in spc.nelson_23([1, 2, 1, 2, 1, 2, 1, 2, -1], 0))
assert all(3 in f for f in spc.nelson_23([1, 2, 3, 4, 5, 6], 100))
assert not any(3 in f for f in spc.nelson_23([1, 2, 3, 4, 5, 4], 100))
assert not any(3 in f for f in spc.nelson_23([1, 2, 3, 3, 4, 5, 6], 100))
down = spc.nelson_23([0, 6, 5, 4, 3, 2, 1], 100)
assert all(3 in f for f in down[1:]) and 3 not in down[0]

# 4) 보이는 구간을 어디서 자르든 같은 샷은 같은 EWMA·MR (런 첫 샷부터 계산)
base = spc.baseline("line_no1", "mold_temperature")
t0 = dt.datetime(2026, 11, 1)
vals = [590, 585, 600, 610, 575, 588, 592, 589, 594, 600, 605, 560]
rows = [{"casting_id": f"L1_x_{i}", "production_count": i + 1, "date": (t0 + dt.timedelta(minutes=2 * i)).time(),
         "v": v} for i, v in enumerate(vals)]
whole = {x["castingId"]: x for x in spc.compute(rows, 0, base)}
part = spc.compute(rows, 7, base)
assert [x["castingId"] for x in part] == [f"L1_x_{i}" for i in range(7, 12)]
for x in part:
    assert abs(x["ewma"] - whole[x["castingId"]]["ewma"]) < 1e-9 and x["mr"] == whole[x["castingId"]]["mr"]
assert whole["L1_x_0"]["runStart"] and whole["L1_x_0"]["mr"] is None
assert abs(whole["L1_x_0"]["ewma"] - (0.2 * 590 + 0.8 * base["cl"])) < 1e-9        # 런 첫 샷은 CL 에서 시작
assert "n1" in whole["L1_x_11"]["marks"] and "n1" not in whole["L1_x_10"]["marks"]   # 560 < I LCL 569.98

# 5) 두 흐름이 섞이면 흐름마다 따로 계산 (A 다음 값은 B 가 아니라 A 의 직전 값과 MR)
mix = [{"casting_id": f"L1_m_{i}", "production_count": p, "date": (t0 + dt.timedelta(minutes=i)).time(), "v": v}
       for i, (p, v) in enumerate([(100, 590), (1, 600), (101, 592), (2, 604), (102, 588)])]
res = spc.compute(mix, 0, base)
assert [x["flow"] for x in res] == [0, 1, 0, 1, 0]
assert res[2]["mr"] == 2 and res[3]["mr"] == 4 and res[4]["mr"] == 4
assert res[1]["runStart"] and not res[2]["runStart"]

# 6) 알림 판정용 관리선 — 라인마다 13개 변수 + 기준 기간, 없는 라인은 None
for line in ("line_no1", "line_no2", "line_no3"):
    lim = spc.limits(line)
    assert len(lim["variables"]) == 13 and lim["baselineFrom"] < lim["baselineTo"] < lim["judgeFrom"]
    assert lim["variables"]["top_temp1"] == spc.baseline(line, "top_temp1")
assert spc.limits("line_no1")["judgeFrom"] == "2026-10-19" and spc.limits("line_no2")["judgeFrom"] == "2026-11-08"
assert spc.limits("line_no9") is None
print("spc_check OK")
