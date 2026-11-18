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
