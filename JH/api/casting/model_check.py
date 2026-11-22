"""1차 검사 모델 파일 경로 검사 자체 점검 — 실행: cd JH/api && uv run python -m casting.model_check

pickle 은 불러올 때 코드가 실행되므로 DB file_name 이 TM/model_ml 밖·다른 형식을 가리키면 거절해야 함.
"""
from casting.model import DEFAULT_FILE, MODEL_DIR, ModelError, _path


def rejects(name) -> bool:
    try:
        _path(name)
    except ModelError:
        return True
    return False


# 기본 모델 파일은 허용, 위치는 TM/model_ml/<이름>/<파일>
assert _path(DEFAULT_FILE) == MODEL_DIR / "DieCasting_XGB_20261114_09" / DEFAULT_FILE
# 경로 구분자·상위 폴더·다른 형식·빈 값·없는 파일은 거절
for bad in ["../x.pkl", "..\\x.pkl", "a/b.pkl", "/etc/passwd", "DieCasting_XGB_20261114_09.joblib",
            "x.pkl.exe", "", None, "NoSuchModel_01.pkl"]:
    assert rejects(bad), bad

print("casting.model 경로 검사: OK")

# ---- v2(CatBoost) 연결 검증 — TM 검증 예시 3샷과 입력 12개·불량 확률이 같아야 함 ----
import csv, math  # noqa: E402
from casting.model import V2_FEATURES, _load, _row_v2  # noqa: E402

V2 = "DieCasting_CatB_20261115_03"
v2 = _load(_path(f"{V2}.pkl"))
with (MODEL_DIR / V2 / f"{V2}_검증예시.csv").open(encoding="utf-8-sig") as f:
    cases = list(csv.DictReader(f))
assert len(cases) == 3
for c in cases:
    # DB 행처럼 소문자 칼럼, 빈 칸 = None
    row = {k.lower(): (None if c[f"원본_{k}"] == "" else float(c[f"원본_{k}"])) for k in V2_FEATURES[:8]}
    x = _row_v2(row, v2["medians"])
    want = [float(c[f"입력_{k}"]) for k in V2_FEATURES]
    assert all(math.isclose(a, b, abs_tol=1e-6) for a, b in zip(x, want)), (c["설명"], x, want)
    import numpy as np  # noqa: E402
    p = float(v2["model"].predict_proba(np.array([x], dtype=np.float32))[:, 1][0])
    assert math.isclose(p, float(c["불량확률"]), abs_tol=1e-6), (c["설명"], p, c["불량확률"])
    assert int(p >= v2["threshold"]) == int(c["경보"]), c["설명"]
print("casting.model v2(CatBoost) TM 검증 예시 3샷: OK")
