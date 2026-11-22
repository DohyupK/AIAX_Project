# 라이브러리 승인 요청 — 사내 문서함 「문서 내용 보기」 (JH → DH)

- 작성: JH, 2026-11-20
- 대상: **DH** (서버·루트 권한자)
- 승인
  | 요청 | 승인자 | 상태 |
  |---|---|---|
  | 1. LibreOffice (서버 `aiax` OS 패키지) | **DH** | **승인 요청** |
  | 2. olefile (JH/api 파이썬 패키지) | JH | JH 확인 후 진행 (JH 폴더만 영향) |
- 승인되면 서버 설치는 JH 가 직접 실행합니다 (아래 「승인 후 할 일」). DH 가 직접 실행해도 됩니다
- 관련 코드: [`JH/api/documents/preview.py`](../api/documents/preview.py), [`JH/api/documents/router.py`](../api/documents/router.py) (`/preview`, `/text`), [`JH/frontend/pages/company_documents/CompanyDocuments.tsx`](../frontend/pages/company_documents/CompanyDocuments.tsx) (`DocContent`)
- 설치 스크립트: [`JH/api/documents/install_office_convert.sh`](../api/documents/install_office_convert.sh)

## 배경

문서 상세 팝업에 「문서 내용」을 붙였습니다. **승인 없이 이미 되는 것**: pdf·이미지 원본(브라우저 기본 기능), hwpx·txt·docx·xlsx·pptx 본문 텍스트(이미 승인된 pypdf·python-docx·openpyxl·python-pptx + 표준 라이브러리).
아래 두 항목은 승인이 필요합니다.

---

## 요청 1 — LibreOffice (서버 시스템 프로그램)

```text
[라이브러리 승인 요청]
- 이름 / 버전 / 오픈소스·라이선스
    LibreOffice (Ubuntu apt 저장소 버전, headless 실행) / MPL-2.0 (일부 LGPLv3)
- 사용 목적
    docx·xlsx·pptx 를 PDF 로 변환해 문서함 팝업에서 원본 모양(서식·표·그림)으로 보여 주기
- 왜 필요한지 / 대안 대비 장점·단점
    · 브라우저는 Office 문서를 직접 못 띄움. 지금은 본문 텍스트만 보임
    · 대안 B (화면 npm: docx-preview·SheetJS): docx·xlsx 만 가능, pptx 는 쓸 만한 것 없음, 패키지 여러 개
    · 대안 C (외부 Office 온라인 뷰어): 사내 문서를 외부로 보내야 함 → 보안상 부적합
    · 장점: 세 형식을 한 도구로, 서버 안에서만 처리 / 단점: 설치 용량 큼(약 300~500MB), 첫 변환 수 초
- 버그 가능성, 확장성, 적합성, 호환성
    · 변환은 별도 프로세스·임시 폴더·임시 프로필로 실행, 90초 시간 제한, 한 번에 하나씩(잠금)
    · 결과 PDF 는 DOCUMENT_ROOT/_preview/<번호>.pdf 에 저장해 재사용 (원본이 바뀌면 다시 변환, 문서 삭제 시 함께 삭제)
    · 설치 안 된 서버에서도 화면은 본문 텍스트로 대신 보여 줌 (깨지지 않음)
    · hwp·hwpx 변환은 LibreOffice 지원이 제한적이라 대상에서 제외 (본문 텍스트로 보임)
- 영향 범위
    서버(aiax) OS 패키지 · JH/api/documents · page_registry 변경 없음 · Python/Node 프로젝트 의존성(uv.lock·package.json) 변경 없음
- 승인 대기
```

**실제로 설치되는 패키지 (전부 명시)**

| 패키지 | 이유 |
|---|---|
| `libreoffice-core` | 변환 엔진 (`soffice --headless`) |
| `libreoffice-writer` | docx 변환 |
| `libreoffice-calc` | xlsx 변환 |
| `libreoffice-impress` | pptx 변환 |
| `fonts-nanum` | PDF 안 한글 글꼴 (없으면 한글이 □ 로 나올 수 있음) |
| (apt 가 함께 설치하는 의존 패키지) | 위 패키지의 필수 라이브러리. `--no-install-recommends` 로 추천 패키지(데스크톱 화면 등)는 제외. 설치 시 apt 가 목록을 출력하므로 기술스택에 그대로 기록 |

---

## 요청 2 — olefile (Python, JH/api)

```text
[라이브러리 승인 요청]
- 이름 / 버전 / 오픈소스·라이선스
    olefile 0.47 / BSD-2-Clause
- 사용 목적
    옛 한글 파일(.hwp, OLE 바이너리)의 본문 텍스트 추출 → 문서 내용 보기 + 문서함 검색(청킹)
- 왜 필요한지 / 대안 대비 장점·단점
    · .hwpx 는 압축 XML 이라 표준 라이브러리로 이미 추출 (구현 완료). .hwp 는 OLE 파일이라 표준 라이브러리로 못 읽음
    · 대안 pyhwp: 기능 많지만 무겁고 유지보수 멈춤 / LibreOffice: hwp 지원 제한적
    · 장점: 순수 파이썬, 의존 패키지 없음, 작음 / 단점: 본문 레코드 해석 코드(약 40줄)를 직접 작성
- 버그 가능성, 확장성, 적합성, 호환성
    · 암호 걸린·배포용 hwp 는 추출 불가 → 빈 텍스트(다운로드 안내), 서버 오류로 번지지 않게 예외 처리
- 영향 범위
    JH/api (uv add olefile) · uv.lock 변경 · page_registry 변경 없음
- 승인 대기
```

- 딸려 오는 패키지: **없음** (olefile 은 의존 패키지 없음)
- 승인 전에는 `.hwp` 는 「본문 텍스트를 읽을 수 없는 문서 — 다운로드」로 안내 (코드에 `ponytail:` 표시)

---

## 승인 후 할 일 (JH)

1. **서버에서 LibreOffice 설치** (root):
   ```bash
   cd /root/AIAX_Project && git pull
   bash JH/api/documents/install_office_convert.sh
   ```
   - 이미 설치돼 있으면 건너뛰고 변환 시험만 함. 마지막 줄에 「변환 시험 성공」이 나오면 완료
   - **JH API 재시작 불필요** (변환할 때마다 soffice 를 찾음)
2. olefile: `cd JH/api && uv add olefile==0.47` → `.hwp` 추출 코드 추가 → PR
3. `개발과정/기술스택.md` 에 LibreOffice(설치 시 apt 가 출력한 패키지 목록 포함)·olefile 기록

## 서버 운영자(DH) 알림

- 서버 `aiax` 에 OS 패키지(위 5개 + 의존)를 추가합니다. 디스크 약 300~500MB
- 서비스(`myapp`)·`.env`·nginx 는 바꾸지 않습니다
- 변환 PDF 저장 위치: `DOCUMENT_ROOT/_preview/` (서버 기준 `/root/document/_preview/`)
