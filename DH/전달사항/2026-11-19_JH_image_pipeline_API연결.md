# 전달사항 — 이미지 lake 조회 연결 (DH → JH)

- 작성: DH, 2026-11-19
- 대상: JH (품질·라벨 등 화면 — **이후 연결**)
- 상태: DH 1차 뼈대·상태 API만. **프론트 페이지는 DH에 없음 — JH가 연결**

## 조회 SoT

- 테이블: `lake.lake_casting_image`
- 계정: `app_lake` (읽기)
- 키: `casting_id`
- 이미지: 컬럼 `image_base64` (E1a). **`original_uri` 로 로드하지 말 것** (원본 PC 파일은 삭제될 수 있음)

## DH 참조

- 설정·토픽·모드: `GET` 상태 API `/config` ([지침](../지침_image_pipeline_임시.md))
- 코드: `DH/api/image_pipeline/`

## 요청

화면에서 샷 `casting_id` 와 이미지를 붙일 때 lake 위 테이블을 사용. 쓰기·Kafka 는 DH 파이프 담당.
