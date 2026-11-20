"""Model Management API — 모델 레지스트리(ai.model_registry) + 공정별 성과지표 조회 (읽기 전용 계정 app_lake)

DB 공정 코드 → 화면 이름 (MS 가 2026-11-18 코드·테이블 이름 변경)
  CAST-QC1 = 품질 1차 검사 (ML)  지표 ai.model_metric_cast_qc1 : PR-AUC·Recall·Precision·F1
  CAST-QC2 = 품질 2차 검사 (DL)  지표 ai.model_metric_cast_qc2 : Accuracy·Recall·Precision·F1
  SAFE-PPE = 보호구 착용 위반     지표 ai.model_metric_safe_ppe : mAP50·Recall·Precision·F1 (검출 모델, 2026-11-20 서버 칼럼 accuracy → map50)
강건성(품질 2차 팝업) = ai.model_robustness : 조건별 Accuracy·Recall·Precision·F1 (원본 = 위 성과지표)
각 공정의 배포(deployed) 모델 = 그 화면이 실제로 쓰는 모델 (품질 1차는 casting/model.py 가 파일을 불러 씀).
배포(POST /{id}/deploy, edit 권한) = app_ai(AI_DATABASE_URL) 로 deployed=true — 같은 공정 기존 배포 해제는 DB 트리거.
  배포 전 모델 파일을 실제로 열어 지금 코드로 쓸 수 있는지 확인 (못 쓰면 거절 → 품질 검사 화면 멈춤 방지).
  품질 1차·2차는 다음 판정부터 새 배포 모델을 씀(casting/model·dl_model 이 매번 DB 배포 행 확인). 보호구는 게이트 프로그램(MS) 재시작 시 적용.
ponytail: 모델 등록(쓰기)은 아직 — 등록 폼은 입력 검사까지.
권한 = org 원본 권한 표(access_code + model_management_page) 실시간 — 인사 변경이 바로 반영.
ponytail: lake 복제(Spark)가 아직 없어 org 원본을 직접 읽음. lake 연결 시 ACCESS_SQL 두 테이블만 lake 사본으로.
권한 사번 = 로그인 세션 (auth/core.acting_employee). 관리자 = edit.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from auth.core import acting_employee, require_session
from casting import dl_model, model as qc1_model

from common.db import connect

router = APIRouter(prefix="/api/models")
log = logging.getLogger("jh.models")
DB = "DATABASE_URL"   # app_lake — ai·org 읽기만

# 공정별 지표 테이블은 행이 그 공정 모델에만 있으므로 공정 조건으로 붙이고 칼럼은 COALESCE 로 한 줄에 모음
SQL = """
SELECT r.model_registry_idx, r.model_name, r.version, r.process_code, r.description, r.file_name, r.deployed,
       to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS created,
       o.pr_auc_score,
       q.accuracy_score, g.map50_score,
       COALESCE(o.recall_score, q.recall_score, g.recall_score) AS recall_score,
       COALESCE(o.precision_score, q.precision_score, g.precision_score) AS precision_score,
       COALESCE(o.f1_score, q.f1_score, g.f1_score) AS f1_score
FROM ai.model_registry r
LEFT JOIN ai.model_metric_cast_qc1 o
       ON r.process_code = 'CAST-QC1' AND (o.model_name, o.version) = (r.model_name, r.version)
LEFT JOIN ai.model_metric_cast_qc2 q
       ON r.process_code = 'CAST-QC2' AND (q.model_name, q.version) = (r.model_name, r.version)
LEFT JOIN ai.model_metric_safe_ppe g
       ON r.process_code = 'SAFE-PPE' AND (g.model_name, g.version) = (r.model_name, r.version)
{where}
ORDER BY r.model_registry_idx
"""

# 사번 → 접근 코드 → Model Management 권한 (행 없으면 접근 불가)
ACCESS_SQL = """
SELECT p.access_level
FROM org.access_code a
JOIN org.model_management_page p ON p.access_code = a.access_code
WHERE a.employee_no = %s
"""


def access_level(request: Request) -> str:
    """현재 계정의 Model Management 권한: 'none' | 'read' | 'edit' — 사번은 로그인 세션에서 (관리자 = edit)"""
    emp, admin = acting_employee(request)
    if admin:   # 관리자 = 모든 권한
        return "edit"
    try:
        with connect(DB) as conn:
            row = conn.execute(ACCESS_SQL, (emp,)).fetchone()
    except Exception:
        log.exception("Model Management 권한 조회 실패")
        raise HTTPException(503, "권한 조회에 실패했습니다.")
    return row["access_level"] if row else "none"


def can_read(level: str = Depends(access_level)) -> str:
    if level == "none":
        raise HTTPException(403, "Model Management 접근 권한이 없습니다.")
    return level


@router.get("/me")
def me(level: str = Depends(access_level)) -> dict:
    return {"accessLevel": level}


def _models(deployed_only: bool) -> list[dict]:
    try:
        with connect(DB) as conn:
            rows = conn.execute(SQL.format(where="WHERE r.deployed" if deployed_only else "")).fetchall()
    except Exception:
        log.exception("모델 레지스트리 조회 실패")
        raise HTTPException(503, "모델 레지스트리 조회에 실패했습니다.")
    num = lambda v: None if v is None else float(v)   # numeric → JSON 숫자
    return [
        {
            "id": r["model_registry_idx"], "name": r["model_name"], "version": r["version"],
            "processCode": r["process_code"], "createdAt": r["created"], "description": r["description"] or "",
            "fileName": r["file_name"], "deployed": r["deployed"],
            "metrics": {"prAuc": num(r["pr_auc_score"]), "accuracy": num(r["accuracy_score"]), "map50": num(r["map50_score"]),
                        "recall": num(r["recall_score"]), "precision": num(r["precision_score"]),
                        "f1": num(r["f1_score"])},
        }
        for r in rows
    ]


@router.get("")
def models(_: str = Depends(can_read)) -> list[dict]:
    """전체 모델 목록 + 공정별 지표 (등록 순). 그 공정에 없는 지표·지표 행이 없으면 null"""
    return _models(False)


@router.get("/deployed")
def deployed() -> list[dict]:
    """공정별 배포 모델만 — 다른 대시보드(보호구 등)의 모델 이름 표시용, 계정 불필요"""
    return _models(True)


# ---------- 배포 ----------
PPE_NOTE = "보호구 판정 프로그램(게이트 PC)을 다시 시작하면 새 모델이 적용됩니다."


def _check_usable(process_code: str, file_name: str | None) -> None:
    """배포하려는 모델을 지금 서버 코드로 쓸 수 있는지 — 못 쓰면 이유와 함께 ValueError"""
    try:
        if process_code == "CAST-QC1":
            qc1_model._load(qc1_model._path(file_name))      # pkl 형식(v1 XGB 8개 / v2 CatBoost 12개) 확인 (패키지 없으면 여기서 실패)
        elif process_code == "CAST-QC2":
            dl_model._load(dl_model._path(file_name))        # onnx 파일·입출력 형식 확인
        # SAFE-PPE: 모델 파일이 게이트 PC 에 있어 서버에서 확인 불가 — 배포만 바꿈
    except (qc1_model.ModelError, dl_model.ModelError) as e:
        raise ValueError(str(e)) from e
    except Exception as e:   # 예: catboost 패키지 없음(ModuleNotFoundError), 깨진 파일
        raise ValueError(f"이 모델을 지금 서버에서 불러올 수 없습니다: {type(e).__name__}: {e}") from e


@router.post("/{model_id}/deploy")
def deploy(model_id: int, request: Request, level: str = Depends(access_level)) -> dict:
    """모델 1개를 배포 — 같은 공정의 기존 배포는 DB 트리거가 해제. edit 권한(관리자 포함)만"""
    if level != "edit":
        raise HTTPException(403, "배포 권한이 없습니다. (Model Management 수정 권한 필요)")
    try:
        with connect(DB) as conn:
            row = conn.execute(
                "SELECT model_name, version, process_code, file_name, deployed FROM ai.model_registry WHERE model_registry_idx = %s",
                (model_id,),
            ).fetchone()
    except Exception:
        log.exception("배포 대상 모델 조회 실패 model_id=%s", model_id)
        raise HTTPException(503, "모델 레지스트리 조회에 실패했습니다.")
    if not row:
        raise HTTPException(404, "모델을 찾을 수 없습니다.")
    note = PPE_NOTE if row["process_code"] == "SAFE-PPE" else "다음 판정부터 새 모델이 적용됩니다."
    if row["deployed"]:
        return {"ok": True, "note": note}
    try:
        _check_usable(row["process_code"], row["file_name"])
    except ValueError as e:
        log.warning("배포 거절 model_id=%s %s %s: %s", model_id, row["model_name"], row["version"], e)
        raise HTTPException(409, f"배포할 수 없습니다 — {e}")
    try:
        with connect("AI_DATABASE_URL") as conn:   # app_ai — model_registry UPDATE 권한 (MS init 17)
            conn.execute("UPDATE ai.model_registry SET deployed = true WHERE model_registry_idx = %s", (model_id,))
    except Exception:
        log.exception("모델 배포 저장 실패 model_id=%s", model_id)
        raise HTTPException(503, "배포 저장에 실패했습니다.")
    who = require_session(request)
    log.info("모델 배포 %s %s (%s) by %s", row["model_name"], row["version"], row["process_code"],
             f"admin:{who.user_id}" if who.admin else who.employee_no)
    return {"ok": True, "note": note}


# 강건성 = 손상 조건별 성능 (ai.model_robustness, 품질 2차 「강건성」 팝업). 「원본」 줄은 화면이 성과지표로 채움
ROBUSTNESS_SQL = """
SELECT b.condition_name, b.accuracy_score, b.recall_score, b.precision_score, b.f1_score
FROM ai.model_registry r
JOIN ai.model_robustness b ON (b.model_name, b.version) = (r.model_name, r.version)
WHERE r.model_registry_idx = %s
"""


@router.get("/{model_id}/robustness")
def robustness(model_id: int, _: str = Depends(can_read)) -> list[dict]:
    """모델 1개의 조건별 강건성 지표. 행이 없으면 빈 목록 (순서는 화면이 정함)"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(ROBUSTNESS_SQL, (model_id,)).fetchall()
    except Exception:
        log.exception("모델 강건성 조회 실패 model_id=%s", model_id)
        raise HTTPException(503, "모델 강건성 조회에 실패했습니다.")
    return [
        {"condition": r["condition_name"], "accuracy": float(r["accuracy_score"]), "recall": float(r["recall_score"]),
         "precision": float(r["precision_score"]), "f1": float(r["f1_score"])}
        for r in rows
    ]
