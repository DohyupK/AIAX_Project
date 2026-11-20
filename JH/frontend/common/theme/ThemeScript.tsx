// 라이트/다크 모드 — 첫 화면 깜빡임 방지 스크립트 (루트 app/layout.tsx <head>에서 JH/main 경유로 호출)

// ponytail: 페이지 이식 중에는 개발 모드에서만 다크 모드 허용. JH 페이지 이식이 모두 끝나면 이 플래그를 true로 바꾸고 제거
export const THEME_TOGGLE_ENABLED = process.env.NODE_ENV !== "production";

// 저장값(localStorage "theme") 우선, 없으면 OS 설정을 따름. 저장소 접근 실패 시 라이트 유지
const SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){console.warn("[theme] 테마 복원 실패",e)}})()`;

export function ThemeScript() {
  if (!THEME_TOGGLE_ENABLED) return null;
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
