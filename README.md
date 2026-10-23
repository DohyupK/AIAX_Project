# TeamProject

팀 제조 AX 웹 워크스페이스입니다.  
루트는 **사이드바가 있는 메인 셸**이고, 개별 기능은 `JH` ~ `DH` 폴더에서 확장합니다.

> 로그인·정식 DB·개별 업무 기능은 **아직 없습니다.** (목업·기능은 이후 등록)

---

## 실행 방법 (개발자)

### 준비

1. [Node.js](https://nodejs.org/) LTS 설치  
2. 패키지 매니저는 **pnpm** (팀 표준)  
   - 없으면: `npm install -g pnpm`  
   - 또는 프로젝트에서: `npm exec pnpm install`

### 설치·실행

```bash
# 프로젝트 루트(TeamProject)에서
pnpm install
pnpm dev
```

브라우저에서 **http://localhost:3000** 을 엽니다.

| 명령 | 설명 |
|------|------|
| `pnpm install` | 의존성 설치 (`pnpm-lock.yaml` 기준) |
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 빌드 결과 실행 |

환경 변수: [`.env.example`](.env.example)을 복사해 `.env`로 사용 (비밀은 Git에 올리지 않음).

설치·승인된 기술 목록: [개발과정/기술스택.md](개발과정/기술스택.md)

---

## 사용 방법 (비개발자)

1. 담당자가 개발 서버 또는 배포 주소를 알려 줍니다.  
2. 왼쪽 **사이드바**에서 팀 카테고리(JH~DH)를 봅니다.  
3. 등록된 기능이 생기면 메뉴에서 고릅니다.  
4. 오류 시 화면 내용과 함께 담당 팀원에게 문의합니다.

메뉴 등록은 팀 내부 [`page_registry.md`](page_registry.md) (루트 파일)에서 관리합니다.

---

## 팀·폴더

| 폴더 | 역할 |
|------|------|
| 루트 | 메인 사이트·사이드바·등록표 (`app/`, `components/`) |
| [JH](JH/README.md) | 팀원 JH |
| [HJ](HJ/README.md) | 팀원 HJ |
| [TM](TM/README.md) | 팀원 TM |
| [MS](MS/README.md) | 팀원 MS |
| [DH](DH/README.md) | 팀원 DH + 루트 권한 창구 |

규칙: **[AGENTS.md](AGENTS.md)**  
기술 기록: [개발과정/기술스택.md](개발과정/기술스택.md)  
확장가능성(문서만): [개발과정/확장가능성.md](개발과정/확장가능성.md)  
DB 목업 기록: [DB연동_내역](DB연동_내역/README.md)

---

## 환경 파일

- `.env` — 실제 비밀 (커밋 금지)  
- [`.env.example`](.env.example) — 사용법·키 이름만
