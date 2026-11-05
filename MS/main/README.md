# MS / main

루트가 호출하는 진입점입니다.  
하위의 `frontend/pages/<기능>` · `api/<기능>` 을 여기서 등록·연결합니다.

## 기능 레지스트리

| 기능 id | frontend 상대경로 | api 상대경로 | 비고 |
|---------|-------------------|--------------|------|
| (예) | ../frontend/pages/example | ../api/example | 추가 시 기입 |
| db | - | - | 화면·API 없는 데이터 인프라. 위치 `../db`, 사용법 [../db/README.md](../db/README.md) |