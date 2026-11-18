# DH / main

루트가 호출하는 진입점입니다.  
하위의 `frontend/pages/<기능>` · `api/<기능>` 을 여기서 등록·연결합니다.

## 기능 레지스트리

| 기능 id | frontend 상대경로 | api 상대경로 | 비고 |
|---------|-------------------|--------------|------|
| image_pipeline | (없음 — JH 이후 연결) | ../api/image_pipeline | 1차 뼈대·상태 API. 지침 `DH/지침_image_pipeline_임시.md` |