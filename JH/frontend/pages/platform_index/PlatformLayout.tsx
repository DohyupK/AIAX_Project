import { PlatformIndex } from "./PlatformIndex";

/**
 * 서버 셸: 사이드바·헤더만 클라이언트 아일랜드, 본문(children)은 RSC 유지.
 * PC는 grid [사이드바 | 헤더/본문], 1024px 미만은 사이드바가 서랍(fixed)이라 1열.
 */
export function PlatformLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] lg:grid-cols-[auto_minmax(0,1fr)]">
      <PlatformIndex />
      {/* ponytail: 본문 여백은 아직 각 페이지 CSS가 담당 — 페이지 이식 때 Mosaic 여백(px-4/6/8, py-8)으로 통일 */}
      <main className="min-w-0 lg:col-start-2 lg:row-start-2">{children}</main>
    </div>
  );
}
