"""Model Management API — 모델 레지스트리(ai.model_registry) + 공정별 성과지표 조회 (읽기 전용 계정 app_lake)

DB 공정 코드 → 화면 이름 (코드 이름은 MS 결정 전까지 유지, 2026-11-18 사용자 결정 2a)
  CAST-OPT  = 품질 1차 검사 (ML)  지표 ai.model_metric_cast_opt  : PR-AUC·Recall·Precision·F1
  CAST-QC   = 품질 2차 검사 (DL)  지표 ai.model_metric_cast_qc   : Accuracy·Recall·Precision·F1
  SAFE-GATE = 보호구 착용 위반     지표 ai.model_metric_safe_gate : Accuracy·Recall·Precision·F1
각 공정의 배포(deployed) 모델 = 그 화면이 실제로 쓰는 모델 (품질 1차는 casting/model.py 가 파일을 불러 씀).
ponytail: 등록·배포(쓰기)는 ai 쓰기 계정이 생긴 뒤 — 배포 시 같은 공정 기존 배포 해제는 DB 트리거가 처리.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from common.db import connect

router = APIRouter(prefix="/api/models")
log = logging.getLogger("jh.models")
DB = "DATABASE_URL"   # app_lake — ai 읽기만

# 공정별 지표 테이블은 행이 그 공정 모델에만 있으므로 공정 조건으로 붙이고 칼럼은 COALESCE 로 한 줄에 모음
SQL = """
SELECT r.model_registry_idx, r.model_name, r.version, r.process_code, r.description, r.file_name, r.deployed,
       to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS created,
       o.pr_auc_score,
       COALESCE(q.accuracy_score, g.accuracy_score) AS accuracy_score,
       COALESCE(o.recall_score, q.recall_score, g.recall_score) AS recall_score,
       COALESCE(o.precision_score, q.precision_score, g.precision_score) AS precision_score,
       COALESCE(o.f1_score, q.f1_score, g.f1_score) AS f1_score
FROM ai.model_registry r
LEFT JOIN ai.model_metric_cast_opt o
       ON r.process_code = 'CAST-OPT' AND (o.model_name, o.version) = (r.model_name, r.version)
LEFT JOIN ai.model_metric_cast_qc q
       ON r.process_code = 'CAST-QC' AND (q.model_name, q.version) = (r.model_name, r.version)
LEFT JOIN ai.model_metric_safe_gate g
       ON r.process_code = 'SAFE-GATE' AND (g.model_name, g.version) = (r.model_name, r.version)
ORDER BY r.model_registry_idx
"""


@router.get("")
def models() -> list[dict]:
    """전체 모델 목록 + 공정별 지표 (등록 순). 그 공정에 없는 지표·지표 행이 없으면 null"""
    try:
        with connect(DB) as conn:
            rows = conn.execute(SQL).fetchall()
    except Exception:
        log.exception("모델 레지스트리 조회 실패")
        raise HTTPException(503, "모델 레지스트리 조회에 실패했습니다.")
    num = lambda v: None if v is None else float(v)   # numeric → JSON 숫자
    return [
        {
            "id": r["model_registry_idx"], "name": r["model_name"], "version": r["version"],
            "processCode": r["process_code"], "createdAt": r["created"], "description": r["description"] or "",
            "fileName": r["file_name"], "deployed": r["deployed"],
            "metrics": {"prAuc": num(r["pr_auc_score"]), "accuracy": num(r["accuracy_score"]),
                        "recall": num(r["recall_score"]), "precision": num(r["precision_score"]),
                        "f1": num(r["f1_score"])},
        }
        for r in rows
    ]
