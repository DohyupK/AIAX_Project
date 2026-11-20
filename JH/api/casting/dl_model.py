"""2차(DL) 품질 검사 모델 — Model Management 「품질 2차 검사」(DB process_code CAST-QC2) 배포 모델 사용

배포 모델 = ai.model_registry 의 CAST-QC2·deployed 행 → file_name 으로 TM/model_dl/<이름>/<파일>.onnx 를 불러옴.
배포 모델이 없으면 기본 모델(TM DieCasting_CNXV2T_20261117_01)을 씀 — 레지스트리 등록 전까지 (1차와 같은 방식).
모델 형식(TM 평가 문서 DieCasting_CNXV2T_20261117_01_METRICS.md):
  입력 image = 사진 픽셀 그대로 uint8 [N,H,W,3] RGB (크기 조정·정규화는 모델 안) / 출력 prob = 불량 확률 [N,1], 0.5 이상 불량.
이미지 = mes.casting_image.image_base64 (Kafka→Flink 수집). 결과 형식은 ai.quality_prediction 칼럼과 같게.
판정은 백그라운드 작업(start_worker, 서버 시작 시 1회 실행)이 미리 해서 ai.quality_prediction 2차 칸에 저장
(계정 app_ai = 루트 .env AI_DATABASE_URL). 화면 API(/second)는 저장된 결과만 읽음 — 요청 중 추론 없음.
ponytail: uvicorn 프로세스 1개 기준. 여러 프로세스로 띄우면 같은 사진을 중복 판정함(결과는 UPSERT 라 틀리진 않음) → 그때 pg advisory lock 추가.
"""
from __future__ import annotations

import base64
import binascii
import io
import logging
import re
import threading
import time
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
BATCH = 32                                             # 한 번에 판정할 사진 수 (장당 수백 KB — 메모리 상한)
IDLE_SEC = 30                                          # 밀린 사진이 없으면 이 간격으로 새 사진 확인

_lock = threading.Lock()
_current: dict = {}   # 메모리에는 지금 쓰는 모델 1개만 — {"key": (name, version, file), "sess": ..., "meta": ...}
_bad: set[str] = set()   # 깨진 이미지 casting_id — 매번 다시 집지 않게 건너뜀 (서버 재시작 시 다시 시도)


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


def predict(sess: ort.InferenceSession, meta: dict, casting_id: str, b64: str, content_type: str | None) -> dict:
    """샷 1개 2차 판정 — ai.quality_prediction 칼럼과 같은 이름 (snake → camel). 이미지가 틀리면 ValueError"""
    img = decode_image(b64, content_type)
    prob = float(sess.run(["prob"], {"image": img[None, ...]})[0][0][0])
    return {
        "castingId": casting_id,
        "modelName": meta["name"],
        "version": meta["version"],
        "result": "fail" if prob >= THRESHOLD else "pass",
        "confidenceScore": prob,   # 불량 확률 0~1
        "predictedAt": datetime.now(timezone.utc).isoformat(),
    }


# 2차 칸만 채움. 1차 칸(qc1_*)은 건드리지 않고, 1차 불량 줄(qc1_result='fail')에는 쓰지 않음 (DB 규칙 23)
SAVE_SQL = """
INSERT INTO ai.quality_prediction (casting_id, model_name, version, result, confidence_score, predicted_at)
VALUES (%(castingId)s, %(modelName)s, %(version)s, %(result)s, %(confidenceScore)s, %(predictedAt)s)
ON CONFLICT (casting_id) DO UPDATE SET
    model_name = EXCLUDED.model_name, version = EXCLUDED.version, result = EXCLUDED.result,
    confidence_score = EXCLUDED.confidence_score, predicted_at = EXCLUDED.predicted_at
WHERE ai.quality_prediction.qc1_result IS DISTINCT FROM 'fail'
"""


def save(results: list[dict]) -> None:
    """판정 결과를 ai.quality_prediction 에 저장 (같은 샷은 2차 칸 갱신). 레지스트리 등록 모델 결과만 넘길 것 (외래키)"""
    if not results:
        return
    with connect("AI_DATABASE_URL") as conn:   # app_ai — quality_prediction SELECT·INSERT·UPDATE
        with conn.cursor() as cur:
            cur.executemany(SAVE_SQL, results)
    log.info("2차 판정 저장 %d건 (%s %s)", len(results), results[0]["modelName"], results[0]["version"])


# 판정할 사진: 2차 결과 없음 / 지금 모델과 다른 모델로 판정 / 판정 뒤 사진이 바뀜. 1차 불량 줄은 2차 대상 아님. 최근 사진부터
PENDING_SQL = """
SELECT i.casting_id, i.updated_at, i.image_base64, i.content_type
FROM mes.casting_image i
LEFT JOIN ai.quality_prediction q USING (casting_id)
WHERE q.qc1_result IS DISTINCT FROM 'fail'
  AND (q.result IS NULL OR q.model_name <> %(name)s OR q.version <> %(version)s OR q.predicted_at < i.updated_at)
  AND NOT (i.casting_id = ANY(%(bad)s))
ORDER BY i.updated_at DESC
LIMIT %(n)s
"""
_warned_default = False


def run_batch() -> int:
    """밀린 사진 최대 BATCH 장 판정·저장 → 집은 사진 수 (BATCH 면 더 남아 있을 수 있음)"""
    global _warned_default
    sess, meta = current()
    if meta["source"] != "registry":   # 미등록 기본 모델은 외래키 때문에 저장 불가
        if not _warned_default:
            log.warning("2차 판정 저장 안 함 — Model Management 「품질 2차 검사」에 배포 모델이 없음 (기본 모델은 미등록)")
            _warned_default = True
        return 0
    _warned_default = False
    with _lock:
        bad = list(_bad)
    with connect("DATABASE_URL") as conn:   # app_lake — mes.casting_image 읽기
        rows = conn.execute(PENDING_SQL, {**meta, "bad": bad, "n": BATCH}).fetchall()
    out = []
    for r in rows:
        try:
            out.append(predict(sess, meta, r["casting_id"], r["image_base64"], r["content_type"]))
        except ValueError as e:   # 깨진 이미지 하나 때문에 전체가 멈추지 않게 — 그 샷은 「판정 대기」로 남음
            log.warning("2차 판정 이미지 사용 불가 casting_id=%s: %s", r["casting_id"], e)
            with _lock:
                _bad.add(r["casting_id"])
    save(out)
    return len(rows)


def _loop() -> None:
    while True:
        try:
            n = run_batch()
        except Exception:   # DB 끊김·모델 파일 문제 — 로그 남기고 잠시 뒤 다시 시도 (작업이 죽지 않게)
            log.exception("2차 판정 작업 실패 — %d초 뒤 다시 시도", IDLE_SEC)
            n = 0
        if n < BATCH:
            time.sleep(IDLE_SEC)


def start_worker() -> None:
    """서버 시작 시 1회 — 백그라운드 판정 작업 (데몬 스레드라 서버 종료 시 같이 끝남)"""
    threading.Thread(target=_loop, name="qc2-judge", daemon=True).start()
    log.info("2차 판정 작업 시작 (%d장씩, 대기 %d초)", BATCH, IDLE_SEC)


def info() -> dict:
    """화면 표시용 — 쓰는 모델(배포 / 기본)·판정 기준"""
    _, meta = current()
    return dict(meta)
