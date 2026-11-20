// JH 공용 Mosaic 스타일 (Tailwind 클래스 묶음) — 페이지마다 같은 카드·배지·버튼·팝업 모양
// 끊음: tablet = 860px 이하, phone = 460px 이하 (app/globals.css, JH/frontend/모바일_페이지_규격.md)

/** 페이지 바깥 여백. 폰 아래 여백 = 전역 떠 있는 버튼(인수인계·챗봇)에 마지막 내용이 가리지 않게 */
export const PAGE = "mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8 phone:px-3 phone:pt-5 phone:pb-24";
export const CRUMB = "text-sm text-gray-500 dark:text-gray-400";
export const H1 = "text-2xl font-bold text-gray-800 md:text-3xl dark:text-gray-100";

export const CARD = "min-w-0 rounded-xl bg-white shadow-sm dark:bg-gray-800";
export const CARD_HEAD =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-gray-100 px-5 py-4 dark:border-gray-700/60 phone:px-4";
export const CARD_TITLE = "font-semibold text-gray-800 dark:text-gray-100";
export const SUB = "text-xs text-gray-500 dark:text-gray-400";

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
/** 보조 버튼 (흰 바탕 + 테두리) */
export const BTN = `inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 phone:py-2.5 ${FOCUS}`;
/** 주 버튼 (현대 남색) */
export const BTN_PRIMARY = `inline-flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-900 dark:bg-brand-500 dark:hover:bg-brand-400 phone:py-3 ${FOCUS}`;
export const FIELD =
  "w-full rounded-lg border-gray-200 bg-white text-sm text-gray-800 shadow-sm placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-500 focus:ring-0 dark:border-gray-700/60 dark:bg-gray-900/30 dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-gray-600 phone:py-3";

/** 상태 배지 — 옅은 상태색 바탕 + 진한 글자 */
export const BADGE = "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium";
export const TONE = {
  ok: "bg-green-500/20 text-green-700 dark:text-green-400",
  warn: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  bad: "bg-red-500/20 text-red-700 dark:text-red-400",
  info: "bg-sky-500/20 text-sky-700 dark:text-sky-400",
} as const;

/** 팝업 — z-65: 전역 떠 있는 버튼(인수인계 55·챗봇 60) 위, 인수인계 팝업(70) 아래. 폰은 아래에서 올라오는 시트 */
export const MODAL_BACKDROP =
  "fixed inset-0 z-[65] flex items-center justify-center bg-gray-900/30 p-4 phone:items-end phone:p-0";
export const MODAL_PANEL =
  "max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-lg dark:bg-gray-800 phone:max-w-none phone:rounded-b-none";
export const CLOSE_BTN = `ml-auto flex size-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700/50 phone:size-10 ${FOCUS}`;
