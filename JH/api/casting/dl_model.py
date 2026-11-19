"""2차(DL) 품질 검사 모델 — Model Management 「품질 2차 검사」(DB process_code CAST-QC2) 배포 모델 사용

배포 모델 = ai.model_registry 의 CAST-QC2·deployed 행 → file_name 으로 TM/model_dl/<이름>/<파일>.onnx 를 불러옴.
배포 모델이 없으면 기본 모델(TM DieCasting_CNXV2T_20261117_01)을 씀 — 레지스트리 등록 전까지 (1차와 같은 방식).
모델 형식(TM 평가 문서 DieCasting_CNXV2T_20261117_01_METRICS.md):
  입력 image = 사진 픽셀 그대로 uint8 [N,H,W,3] RGB (크기 조정·정규화는 모델 안) / 출력 prob = 불량 확률 [N,1], 0.5 이상 불량.
이미지 = mes.casting_image.image_base64 (Kafka→Flink 수집). 결과 형식은 ai.quality_prediction 칼럼과 같게.
ponytail: ai 쓰기 계정이 없어 결과는 서버 메모리 캐시에만 둠 — 계정이 생기면 ai.quality_prediction INSERT 로 교체.
"""
from __future__ import annotations

import base64
import binascii
import io
import logging
import re
import threading
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from common.db import connect

log = logging.getLogger("jh.casting.dl_model")

MODEL_DIR = (Path(__file__).resolve().parents[3] / "TM" / "model_dl").resolve()
DEFAULT_NAME = "DieCasting_CNXV2T_20261117_01"         # 레지스트리 등록 전 기본 모델
DEFAULT_FILE = f"{DEFAULT_NAME}.onnx"
PROCESS_CODE = "CAST-QC2"                              # DB 코드 = 화면 「품질 2차 검사」
FILE_RE = re.compile(r"^[A-Za-z0-9_.-]+\.onnx$")       # 파일 이름만 (경로 구분자 금지)
THRESHOLD = 0.5                                        # 불량 확률 ≥ 0.5 → 불량 (TM 평가 문서 판정 기준)
IMAGE_TYPES = {"image/png", "image/jpeg"}
MAX_PIXELS = 4096 * 4096                               # 비정상적으로 큰 이미지 거절 (학습 입력 512×512)
CACHE_MAX = 5000                                       # 샷별 결과 캐시 상한 — 넘으면 오래된 것부터 버림

_lock = threading.Lock()
_current: dict = {}   # 메모리에는 지금 쓰는 모델 1개만 — {"key": (name, version, file), "sess": ..., "meta": ...}
_cache: OrderedDict[tuple, dict] = OrderedDict()   # (casting_id, image updated_at, 모델 key) → 결과


class ModelError(RuntimeError):
    """배포 모델 파일이 없거나 형식이 맞지 않음 — 화면에 그대로 안내"""


def _deployed() -> dict | None:
    """DB 에서 품질 2차 검사 배포 모델 (없으면 None)"""
    with connect("DATABASE_URL") as conn:
        return conn.execute(
            "SELECT model_name, version, file_name FROM ai.model_registry WHERE process_code = %s AND deployed",
            (PROCESS_CODE,),
        ).fetchone()


def _path(file_name: str | None) -> Path:
    if not file_name or not FILE_RE.match(file_name):
        raise ModelError(f"배포 모델 파일 이름이 올바르지 않습니다: {file_name!r} (.onnx 파일 이름만 허용)")
    p = (MODEL_DIR / Path(file_name).stem / file_name).resolve()
    if not p.is_relative_to(MODEL_DIR) or not p.is_file():
        raise ModelError(f"배포 모델 파일을 찾을 수 없습니다: TM/model_dl/{Path(file_name).stem}/{file_name}")
    if p.stat().st_size < 1024:   # Git LFS 를 받지 않으면 130바이트 포인터 텍스트만 있음
        raise ModelError(f"모델 파일이 Git LFS 포인터입니다 ({file_name}) — `git lfs pull` 로 실제 파일을 받으세요")
    return p


def _load(path: Path) -> ort.InferenceSession:
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    i, o = sess.get_inputs()[0], sess.get_outputs()[0]
    if i.name != "image" or i.type != "tensor(uint8)" or o.name != "prob":
        raise ModelError(f"모델 입출력 형식이 다릅니다 ({path.name}): {i.name} {i.type} → {o.name} (image uint8 → prob 필요)")
    return sess


def current() -> tuple[ort.InferenceSession, dict]:
    """(추론 세션, 표시용 정보) — 배포 모델이 바뀌면 새로 불러오고 이전 모델은 메모리에서 버림"""
    row = _deployed()
    if row:
        key = (row["model_name"], row["version"], row["file_name"])
        meta = {"name": row["model_name"], "version": row["version"], "source": "registry"}
    else:
        key = (DEFAULT_NAME, "", DEFAULT_FILE)
        meta = {"name": DEFAULT_NAME, "version": "", "source": "default"}
    with _lock:
        if _current.get("key") != key:
            sess = _load(_path(key[2]))
            _current.clear()
            _cache.clear()   # 모델이 바뀌면 이전 결과는 의미 없음
            _current.update(key=key, sess=sess, meta={**meta, "threshold": THRESHOLD})
            log.info("2차 검사 모델 로드 %s %s (%s)", key[0], key[1], meta["source"])
        return _current["sess"], _current["meta"]


def decode_image(b64: str, content_type: str | None) -> np.ndarray:
    """base64 PNG/JPEG → uint8 [H,W,3] RGB. 형식이 틀리면 ValueError"""
    if content_type not in IMAGE_TYPES:
        raise ValueError(f"지원하지 않는 이미지 형식: {content_type}")
    try:
        raw = base64.b64decode(b64, validate=True)
    except (binascii.Error, TypeError) as e:
        raise ValueError("이미지 base64 가 올바르지 않습니다") from e
    with Image.open(io.BytesIO(raw)) as im:
        if im.width * im.height > MAX_PIXELS:
            raise ValueError(f"이미지가 너무 큽니다: {im.width}×{im.height}")
        return np.asarray(im.convert("RGB"), dtype=np.uint8)


def cached(casting_id: str, updated_at) -> dict | None:
    """이미 추론한 결과 (이미지·모델이 같을 때만)"""
    with _lock:
        key = (casting_id, updated_at, _current.get("key"))
        hit = _cache.get(key)
        if hit is not None:
            _cache.move_to_end(key)
        return hit


def predict(casting_id: str, updated_at, b64: str, content_type: str | None) -> dict:
    """샷 1개 2차 판정 — ai.quality_prediction 칼럼과 같은 이름 (castingId 제외 snake → camel)"""
    sess, meta = current()
    img = decode_image(b64, content_type)
    prob = float(sess.run(["prob"], {"image": img[None, ...]})[0][0][0])
    out = {
        "castingId": casting_id,
        "modelName": meta["name"],
        "version": meta["version"],
        "result": "fail" if prob >= THRESHOLD else "pass",
        "confidenceScore": prob,   # 불량 확률 0~1
        "predictedAt": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        _cache[(casting_id, updated_at, _current.get("key"))] = out
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)
    return out


def info() -> dict:
    """화면 표시용 — 쓰는 모델(배포 / 기본)·판정 기준"""
    _, meta = current()
    return dict(meta)
