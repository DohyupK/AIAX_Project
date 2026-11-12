// 회사별 출입 보고서 — 새 창에 보고서 표를 그리고 브라우저 인쇄 창을 띄움 (대상에서 「PDF로 저장」 선택)
// 라이브러리 없이 PDF를 만들기 위한 방식. 값은 textContent로만 넣어 기록 데이터가 HTML로 해석되지 않게 함
import type { ScanRecord } from "./data";
import { GEAR_LABEL, type Gear } from "./rules";

export type ReportRow = ScanRecord & { missing: Gear[]; pass: boolean };

const STYLE = `
  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #1d2433; margin: 24px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: #6b7484; }
  .stats { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #c9ced6; padding: 5px 7px; text-align: left; }
  th { background: #eef0f3; }
  .bad { color: #c53030; font-weight: 600; }
  @page { margin: 12mm; }
`;

/** 보고서 창 열기. 팝업이 차단되면 false */
export function openCompanyReport(company: string, rows: ReportRow[]): boolean {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;

  const doc = win.document;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const period = dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : "-";
  const passCount = rows.filter((r) => r.pass).length;

  // 인쇄 창의 「PDF로 저장」 기본 파일명이 됨
  doc.title = `작업자안전_보고서_${company}_${dates[dates.length - 1] ?? ""}`;
  const style = doc.createElement("style");
  style.textContent = STYLE;
  doc.head.appendChild(style);

  const el = (tag: string, text?: string, cls?: string) => {
    const e = doc.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  doc.body.append(
    el("h1", `작업자 안전 출입 보고서 — ${company}`),
    el("p", `구분: ${rows[0]?.companyType ?? "-"} · 기간: ${period} · 출력: ${new Date().toLocaleString("ko-KR")}`),
  );

  const stats = el("div", undefined, "stats");
  stats.append(
    el("span", `전체 ${rows.length}건`),
    el("span", `통과 ${passCount}건`),
    el("span", `위반 ${rows.length - passCount}건`, "bad"),
  );
  doc.body.append(stats);

  const table = el("table");
  const thead = el("thead");
  const tbody = el("tbody");
  const headRow = el("tr");
  for (const h of ["날짜", "시간", "유저 ID", "게이트", "회사", "구분", "위반 항목", "결과"]) headRow.append(el("th", h));
  thead.append(headRow);
  table.append(thead, tbody);
  for (const r of rows) {
    const tr = el("tr");
    tr.append(
      el("td", r.date),
      el("td", r.time),
      el("td", r.userId),
      el("td", r.gate),
      el("td", r.company),
      el("td", r.companyType),
      el("td", r.pass ? "-" : r.missing.map((g) => GEAR_LABEL[g]).join(", ")),
      el("td", r.pass ? "통과" : "위반", r.pass ? undefined : "bad"),
    );
    tbody.append(tr);
  }
  doc.body.append(table);

  win.onafterprint = () => win.close(); // 저장·취소 후 보고서 창 정리
  win.focus();
  win.print();
  return true;
}
