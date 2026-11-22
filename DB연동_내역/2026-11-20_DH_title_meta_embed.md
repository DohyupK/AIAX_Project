# DB 연동 — 제목 메타 임베딩 (2026-11-20, DH)

| 항목 | 내용 |
|------|------|
| 기능 | 사내 문서·혜진봇 검색에 제목·파일명·분류 반영 |
| 새 테이블 | **없음** |
| 변경 | JH `documents/jobs.py` — 임베딩 입력에 메타 접두. 본문 없으면 메타 1청크 |
| 재청킹 | 기존 벡터에 제목이 없으면 검색 개선 안 됨 → `cd JH/api && uv run python -m documents.requeue_all` |
| 비고 | `document_chunk.content`는 본문 유지(메타만 청크는 메타 문자열). OCR 없음 |
