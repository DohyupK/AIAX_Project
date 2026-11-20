# JH 업무일지

**주요 기능만** 적습니다. 세부·스택·목적은 [기능표.md](../기능표.md) (또는 외부 링크)를 보세요.

| 날짜 | 주요 기능 | 기능표 링크 |
|------|-----------|-------------|
| 2026-11-21 | 메인 대시보드 Mosaic 이식(라이트/다크, PC 2단·860 1열·460 폰 구성) · 일일 공지 DB 테이블 대신 브라우저 캐시(503 해결 방향 변경) · 셸 서랍·사이드바가 떠 있는 버튼에 가리던 문제 수정 | [main_dashboard](../기능표.md#메인-대시보드-main_dashboard) |
| 2026-11-20 | UI 템플릿(Mosaic) 이식 1·3단계: Tailwind v4 도입(사용자·DH 승인), 디자인 값·라이트/다크 모드 기반, 사이드바·헤더 셸 교체(PC 접힘·모바일 서랍) | [platform_index](../기능표.md#공정-안전-플랫폼-인덱스-platform_index) |
| 2026-11-20 | 공정 최적화 live ×20 ↔ MS 샷 생성 배속 (`/api/casting/demo-speed`, DH 구현·승인) | [process_optimization](../기능표.md#공정-최적화-대시보드-process_optimization) |
| 2026-11-20 | 품질 검사 1차(ML): 판정 결과 DB 저장(ai.quality_prediction qc1_*), 2차는 1차 양품만 | [quality_inspection](../기능표.md#품질-검사-대시보드-quality_inspection) |
| 2026-11-20 | 교대 인수인계 리포트: 3교대 구간 경보·전체 불량 집계, 전역 「인수인계 실행」·전환 후 자동 팝업·PDF 출력 (DH 구현·JH 승인, app/layout 마운트) | [shift_handover](../기능표.md#교대-인수인계-리포트-shift_handover) |
| 2026-11-20 | 품질 검사 2차: 「판정 대기」와 「이미지 없음」 구분, 샷 목록 팝업에 촬영 사진 표시 | [quality_inspection](../기능표.md#품질-검사-대시보드-quality_inspection) |
| 2026-11-20 | 품질 검사 2차(DL): 서버가 사진을 미리 판정해 DB(ai.quality_prediction)에 저장, 화면은 DB만 읽음(시간 초과 해결)·「판정 대기 N장」 표시 | [quality_inspection](../기능표.md#품질-검사-대시보드-quality_inspection) |
| 2026-11-20 | 불량 유형 라벨링: 목록 = 2차 판정 불량(result='fail'), 실제 사진 연결(MS 이미지 API) | [defect_labeling](../기능표.md#불량-유형-라벨링-defect_labeling) |
| 2026-11-20 | 공정 최적화: 「관리도 알림」 제목 클릭 → 그날 알림 전체 팝업(닫힌 알림 포함), 줄 클릭 → 상세 | [process_optimization](../기능표.md#공정-최적화-대시보드-process_optimization) |
| 2026-11-20 | 슬랙 연동 + 일일 경영 노션/슬랙 수동 · 크론 `push/daily`(노션+슬랙) · 보호구 슬랙 보내기 | [management_report](../기능표.md#경영-관리자-리포트-management_report) · [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-20 | 노션 연동: 일일 경영 리포트 자동(`POST /api/report/notion/daily`) · 보호구 위반 보고서 「노션으로 보내기」 | [management_report](../기능표.md#경영-관리자-리포트-management_report) · [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-20 | 메인 대시보드: 전날 관리도 알람 AI 일일 공지 (`/api/main/daily-notice` → org 캐시, 공지 맨 앞) | [main_dashboard](../기능표.md#메인-대시보드-main_dashboard) |
| 2026-11-18 | Model Management: 탭 이름 품질 1차 검사·품질 2차 검사·보호구 착용 위반, 세 탭 DB 연결. 배포 모델 = 실제 사용 모델 (품질 검사 1차 판정 모델 교체, 2차·보호구는 이름 표시) | [model_management](../기능표.md#model-management-model_management) |
| 2026-11-18 | Model Management: 성과지표 공정별(공정 최적화 = PR-AUC·Recall·Precision·F1), 공정 최적화 탭 서버 DB 연결(읽기), 목업 56건·localStorage 배포 연동 삭제 | [model_management](../기능표.md#model-management-model_management) |
| 2026-11-18 | 품질 검사: 1차·2차 카드 배치 복원 — 1차 = 실제 모델, 2차(DL)는 「연결 전」 자리 | [quality_inspection](../기능표.md#품질-검사-대시보드-quality_inspection) |
| 2026-11-18 | 품질 검사: 1차(ML) 검사 연결 — TM 배포 모델 DieCasting_XGB_20261114_09 로 샷 점수·판정, 실제 판정과 비교(맞힌/놓친 불량·Recall·Precision), 점수 그래프. xgboost-cpu 승인·추가 | [quality_inspection](../기능표.md#품질-검사-대시보드-quality_inspection) |
| 2026-11-18 | 불량 유형 라벨링: 목업 → DB 연결 (불량 샷 = lake passorfail=1, 라벨 상태 = ai.defect_label·defect_discard), 일자 선택. 저장은 쓰기 계정 연결 전까지 막음 | [defect_labeling](../기능표.md#불량-유형-라벨링-defect_labeling) |
| 2026-11-18 | 인사 관리: 탭 인원에 「명」 단위, 인사 담당자 전용 「전체」 버튼(부서·팀 카드 전부 한 화면에) | [hr_management](../기능표.md#인사-관리-hr_management) |
| 2026-11-18 | 보호구 착용 위반 대시보드: 날짜 선택 → 달력으로 시작일~종료일 기간 조회 (최대 92일) | [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-18 | 보호구 착용 위반 대시보드: 업체 필터·회사 출입 현황을 본사/하청 업체로 정리, 본사 선택 시 부서 버튼 필터 | [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-18 | 보호구 착용 위반 대시보드: 목업 → DB 연결 (판정 ai.ppe_check + 출입·소속 lake), 칼럼 DB 기준(게이트 a·b, 사번·하청 카드), 날짜 선택·「확인 필요」, 월간 보고서 DB 집계 | [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-18 | 인사 관리: 명단·권한 코드는 DB 트리거에 맡김, 팀 이름(casting1 … tf) 표시 | [hr_management](../기능표.md#인사-관리-hr_management) |
| 2026-11-17 | 인사 관리: org DB 개편 대응 — 생년월일 입력·나이 자동 계산, 새 부서·직급·팀 코드·사번·권한 코드 규칙 | [hr_management](../기능표.md#인사-관리-hr_management) |
| 2026-11-17 | 보호구 착용 위반 대시보드: 명칭·경로 변경(/safety/ppe-violation), 업체 필터·정렬, 우측 상단 「위반 보고서」 → 월별 목록 → 출력본 양식 보고서·PDF 출력 (업로드 삭제) | [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-17 | Model Management: 배포 버튼 → localStorage → 대시보드 활성 모델명 연동 (추론 미연동) | [model_management](../기능표.md#model-management-model_management) |
| 2026-11-17 | Model Management: TM DieCasting 56건 목업·명명 규칙 반영 (DH 허가) | [model_management](../기능표.md#model-management-model_management) |
| 2026-11-11 | Model Management Overview 배치 변경: 생성일·배포 여부를 왼쪽으로, 성과지표를 오른쪽으로, 적용 횟수 표시 삭제 | [model_management](../기능표.md#model-management-model_management) |
| 2026-11-11 | 관리도(SPC): 온도 변수 EWMA(σ=전체 표준편차), 압력·사이클 I-MR + Nelson 규칙 1·2·3, 처음 100샷 기준 고정, CL 점선 | [process_optimization](../기능표.md#공정-최적화-대시보드-process_optimization) |
| 2026-11-11 | 온도 제어 → 공정 최적화 개편: 지표 4종, 알람 로그 팝업, 공정 변수 모니터 4×2, 관리도(SPC) UCL/LCL·툴팁 | [process_optimization](../기능표.md#공정-최적화-대시보드-process_optimization) |
| 2026-11-10 | 사이드바 접기/펴기 버튼, 설정 아이콘(표시만) | [platform_index](../기능표.md#공정-안전-플랫폼-인덱스-platform_index) |
| 2026-11-10 | 메인 대시보드: 머리글 제거, 공지 상세 팝업, 메모 제목/내용·Enter 저장·쿠키 저장, 오늘 날짜 강조 | [main_dashboard](../기능표.md#메인-대시보드-main_dashboard) |
| 2026-11-10 | 작업자 안전: 머리글 제거, 구분(본사/하청업체), 회사 출입 현황·회사 선택·보고서(PDF 인쇄) | [ppe_violation](../기능표.md#보호구-착용-위반-대시보드-ppe_violation) |
| 2026-11-10 | Model Management 페이지: 공정 필터 탭, Overview, 배포 고정 목록, 모델 등록 팝업 | [model_management](../기능표.md#model-management-model_management) |
