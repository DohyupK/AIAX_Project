"""루트 .env 를 os.environ 에 적재 (비밀 파일은 프로젝트 루트만).

추가 dotenv 패키지 없이 파싱. 이미 있는 환경변수는 덮어쓰지 않음.
"""
from __future__ import annotations

import os
from pathlib import Path

_LOADED = False


def project_root() -> Path:
    # DH/api/image_pipeline/env_load.py → 루트 = parents[3]
    return Path(__file__).resolve().parents[3]


def load_root_env(*, force: bool = False) -> Path:
    """루트 .env 로드. 반환: .env 경로 (없어도 Path)."""
    global _LOADED
    path = project_root() / ".env"
    if _LOADED and not force:
        return path
    if path.is_file():
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    _LOADED = True
    return path
