/**
 * Shift 화면 맥락 — 메모리 링버퍼만.
 * console / localStorage / sessionStorage / data-* 덤프 금지. 대화 DB 저장 없음.
 */

export interface UiAction {
  t: string;
  kind: string;
  label: string;
}

export interface UiContextSnapshot {
  path: string;
  page_label: string;
  actions: UiAction[];
}

const MAX_ACTIONS = 15;
const LABEL_MAX = 80;

/** pathname → 표시명 (page_registry 경로 기준, 하드맵) */
const PAGE_LABELS: Record<string, string> = {
  "/": "주조·프레스 공정 안전 플랫폼",
  "/casting/process-optimization": "공정 최적화",
  "/casting/quality-inspection": "품질 검사",
  "/casting/defect-labeling": "불량 유형 라벨링",
  "/documents": "사내 문서함",
  "/model-management": "Model Management",
  "/hr": "인사 관리",
  "/management-report": "경영 관리자 리포트",
  "/safety/ppe-violation": "보호구 착용 위반",
  "/al-price": "알루미늄 가격",
};

let actions: UiAction[] = [];
let started = false;
let onClick: ((e: Event) => void) | null = null;
let onChange: ((e: Event) => void) | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function trimLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
}

function pushAction(kind: string, label: string): void {
  const L = trimLabel(label);
  if (!L) return;
  actions.push({ t: nowIso(), kind, label: L });
  if (actions.length > MAX_ACTIONS) {
    actions = actions.slice(-MAX_ACTIONS);
  }
}

function labelFromTarget(el: Element | null): string {
  if (!el || !(el instanceof HTMLElement)) return "";
  // password 입력값은 읽지 않음
  if (el instanceof HTMLInputElement && el.type === "password") return "";
  if (el instanceof HTMLTextAreaElement) return "";

  const aria = el.getAttribute("aria-label");
  if (aria) return aria;

  if (el instanceof HTMLSelectElement) {
    const opt = el.options[el.selectedIndex];
    return opt ? `선택 ${opt.text}` : "선택 변경";
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      return `${el.type} ${el.checked ? "on" : "off"} ${el.name || el.id || ""}`.trim();
    }
    // 일반 text 값은 넣지 않음 (보안) — name/placeholder만
    return `입력란 ${el.name || el.placeholder || el.id || ""}`.trim();
  }

  const btn = el.closest("button, a, [role='button']");
  if (btn instanceof HTMLElement) {
    const t = (btn.innerText || btn.textContent || "").trim();
    if (t) return t.slice(0, LABEL_MAX);
    const al = btn.getAttribute("aria-label");
    if (al) return al;
  }
  return "";
}

function pageLabelFor(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  // trailing slash 제거 매칭
  const bare = path.replace(/\/$/, "") || "/";
  return PAGE_LABELS[bare] || bare;
}

/** 캡처 시작 (HyejinBot 마운트). 콘솔에 찍지 않음. */
export function startUiContextCapture(): void {
  if (typeof document === "undefined" || started) return;
  started = true;

  onClick = (e: Event) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    // Shift 패널 내부 클릭은 맥락에서 제외(채팅 UI 노이즈)
    if (t.closest('[aria-label="Shift 채팅"], [aria-label="Shift 열기"], [aria-label="Shift 닫기"]')) {
      return;
    }
    const label = labelFromTarget(t);
    if (label) pushAction("click", label);
  };

  onChange = (e: Event) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[aria-label="Shift 채팅"]')) return;
    const label = labelFromTarget(t);
    if (label) pushAction("change", label);
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
}

export function stopUiContextCapture(): void {
  if (!started) return;
  if (onClick) document.removeEventListener("click", onClick, true);
  if (onChange) document.removeEventListener("change", onChange, true);
  onClick = null;
  onChange = null;
  started = false;
}

/** ask 직전에만 복사본 반환. 응답에 에코하지 않음. */
export function snapshotUiContext(): UiContextSnapshot {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  return {
    path,
    page_label: pageLabelFor(path),
    actions: actions.map((a) => ({ ...a })),
  };
}
