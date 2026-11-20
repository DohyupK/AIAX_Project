"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GEAR_LABEL } from "./rules";
import { fetchMonthlyRaw } from "./data";
import { SITE, listMonthlyReports, type MonthlyReport } from "./monthly";
import s from "./PpeReport.module.css";

// 인쇄 시 보고서 팝업만 출력: 팝업을 body 직속(portal)으로 두고 나머지 body 자식은 숨김
// CSS Modules 는 전역 선택자 불가 → <style> 주입 (경영 관리자 리포트와 같은 방식)
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  body > *:not([data-print-root]) { display: none !important; }
  [data-print-root] { position: static !important; display: block !important; padding: 0 !important; background: none !important; }
  [data-print-area] { width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; }
  [data-print-hide] { display: none !important; }
  [data-print-area] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const fmt = (n: number | null) => (n === null ? "-" : n.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const int = (n: number) => n.toLocaleString("ko-KR");

/** 위반 보고서 — 월별 목록 팝업, 행을 누르면 보고서 팝업 (닫으면 목록으로 복귀) */
export default function ViolationReports({ onClose }: { onClose: () => void }) {
  // 원자료는 API(ai.ppe_check + lake), 비율·순위는 monthly.ts 가 계산. null = 불러오는 중
  const [reports, setReports] = useState<MonthlyReport[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<MonthlyReport | null>(null);
  const close = open ? () => setOpen(null) : onClose;

  useEffect(() => {
    let alive = true; // 팝업을 닫은 뒤 도착한 응답은 버림
    fetchMonthlyRaw()
      .then((raw) => alive && setReports(listMonthlyReports(raw)))
      .catch((e: unknown) => {
        console.error("[ppe_violation] 월간 보고서 조회 실패", e);
        if (alive) setError("보고서 데이터를 불러오지 못했습니다. JH API 서버(127.0.0.1:8000)를 확인해 주세요.");
      });
    return () => { alive = false; };
  }, []);

  // Esc = 맨 위 팝업 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return createPortal(
    <div className={s.backdrop} data-print-root onClick={close}>
      {open ? <ReportDialog r={open} onClose={close} /> : (
        <div className={`${s.dialog} ${s.listDialog}`} role="dialog" aria-modal="true" aria-labelledby="ppe-list-title" onClick={(e) => e.stopPropagation()}>
          <div className={s.toolbar}>
            <h2 id="ppe-list-title" className={s.listTitle}>위반 보고서</h2>
            <button type="button" className={s.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
          </div>
          <p className={s.sub}>
            {error || (reports ? `월별 · 최신순 · ${reports.length}건 · 행을 누르면 보고서 열기` : "불러오는 중…")}
          </p>
          <div className={s.listWrap}>
            <table className={s.listTable}>
              <thead>
                <tr><th>보고서</th><th>대상 기간</th><th>판정 수</th><th>위반</th><th>위반율(1,000회당)</th><th>전월 대비</th></tr>
              </thead>
              <tbody>
                {reports?.map((r) => (
                  <tr key={r.month} onClick={() => setOpen(r)}>
                    <td>
                      <button type="button" className={s.rowBtn} onClick={(e) => { e.stopPropagation(); setOpen(r); }}>
                        {r.title} 보호구 착용 위반 보고서
                      </button>
                    </td>
                    <td className={s.num}>{r.period}</td>
                    <td className={s.num}>{int(r.scans)}</td>
                    <td className={`${s.num} ${s.bad}`}>{int(r.violations)}건</td>
                    <td className={s.num}>{fmt(r.rate)}</td>
                    <td className={`${s.num} ${r.delta === null ? "" : r.delta <= 0 ? s.good : s.bad}`}>
                      {r.delta === null ? "-" : `${r.delta > 0 ? "+" : r.delta < 0 ? "−" : ""}${fmt(Math.abs(r.delta))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/** 출력본 양식 그대로의 월간 보고서 */
function ReportDialog({ r, onClose }: { r: MonthlyReport; onClose: () => void }) {
  const docTitle = `보호구_착용_위반_보고서_${r.title.replace(/\s/g, "")}`;
  const [notionMsg, setNotionMsg] = useState("");
  const [notionBusy, setNotionBusy] = useState(false);

  function printPdf() {
    // PDF 기본 파일명 = 문서 제목 → 인쇄 동안만 보고서 제목으로 바꿈
    const prevTitle = document.title;
    document.title = docTitle;
    window.print(); // 인쇄 창이 닫힐 때까지 대기 (동기)
    document.title = prevTitle;
  }

  async function sendNotion() {
    setNotionBusy(true);
    setNotionMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/ppe/notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: r.month }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: unknown; url?: string; created?: boolean;
      };
      if (!res.ok) {
        // FastAPI detail = 문자열 | 검증 오류 배열 | 객체 — 그대로 보이게
        const d = data.detail;
        let detail = "노션 전송에 실패했습니다.";
        if (typeof d === "string") detail = d;
        else if (Array.isArray(d)) {
          detail = d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x))).join("; ") || detail;
        } else if (d != null) detail = JSON.stringify(d);
        else detail = `노션 전송에 실패했습니다. (HTTP ${res.status})`;
        throw new Error(detail);
      }
      setNotionMsg(data.created === false ? "노션 페이지를 갱신했습니다." : "노션 페이지를 만들었습니다.");
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      console.error("[ppe_violation] 노션 전송 실패", e);
      setNotionMsg(e instanceof Error ? e.message : "노션 전송에 실패했습니다.");
    } finally {
      setNotionBusy(false);
    }
  }

  const prevNo = r.prevMonthNo;
  return (
    <div className={`${s.dialog} ${s.reportDialog}`} role="dialog" aria-modal="true" aria-labelledby="ppe-report-title" data-print-area onClick={(e) => e.stopPropagation()}>
      <style>{PRINT_CSS}</style>
      <div className={s.toolbar} data-print-hide>
        <button type="button" className={s.backBtn} onClick={onClose}>← 목록</button>
        <button type="button" className={s.printBtn} onClick={printPdf}>PDF 출력</button>
        <button type="button" className={s.notionBtn} onClick={sendNotion} disabled={notionBusy}>
          {notionBusy ? "전송 중…" : "노션으로 보내기"}
        </button>
        <button type="button" className={s.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
      </div>
      {notionMsg && <p className={s.notionMsg} data-print-hide role="status">{notionMsg}</p>}

      <div className={s.paper}>
        {/* 결재란 — 출력본 수기 서명용 */}
        <table className={s.sign} aria-label="결재란">
          <tbody>
            <tr><th rowSpan={2}>결<br />재</th><th>담당</th><th>부서장</th><th>기관장</th></tr>
            <tr><td /><td /><td /></tr>
          </tbody>
        </table>

        <h2 id="ppe-report-title" className={s.title}>보호구 착용 위반 보고서</h2>
        <p className={s.subtitle}>{r.title} ({r.period}, 가동일 {r.workDays}일) · {SITE}</p>

        <h3 className={s.sec}>① 핵심 지표</h3>
        <div className={s.kpis}>
          <div className={s.kpi}>
            <span>판정 수</span><b className={s.num}>{int(r.scans)}</b>
            <small>{r.entered === r.registered ? `등록 ${r.registered}명 전원 출입` : `등록 ${r.registered}명 중 ${r.entered}명 출입`}</small>
          </div>
          <div className={s.kpi}>
            <span>위반</span><b className={`${s.num} ${s.bad}`}>{int(r.violations)}건</b><small>미충족 판정</small>
          </div>
          <div className={s.kpi}>
            <span>위반율 (1,000회당)</span><b className={s.num}>{fmt(r.rate)}</b><small>{r.rank || " "}</small>
          </div>
          <div className={s.kpi}>
            <span>전월({prevNo}월) 대비</span>
            <b className={`${s.num} ${r.delta === null ? "" : r.delta <= 0 ? s.good : s.bad}`}>
              {r.delta === null ? "-" : `${r.delta > 0 ? "+" : r.delta < 0 ? "−" : ""}${fmt(Math.abs(r.delta))}`}
            </b>
            <small>{r.prevRate === null ? "전월 기록 없음" : `${prevNo}월 ${fmt(r.prevRate)}`}</small>
          </div>
        </div>

        <h3 className={s.sec}>② 어디서: 소속·게이트별 <small>(위반율 높은 순)</small></h3>
        <table className={s.grid}>
          <thead>
            <tr>
              <th>소속</th><th>구분</th><th>게이트</th>
              <th>{r.monthNo}월 판정</th><th>{r.monthNo}월 위반</th><th>{r.monthNo}월 위반율</th><th>전월({prevNo}월)</th>
            </tr>
          </thead>
          <tbody>
            {r.units.map((u) => (
              <tr key={`${u.name}-${u.gate}`}>
                <td>{u.name}</td><td>{u.type}</td><td>{u.gate}</td>
                <td className={s.num}>{int(u.scans)}</td><td className={s.num}>{int(u.violations)}</td>
                <td className={s.num}><b>{fmt(u.rate)}</b></td><td className={s.num}>{fmt(u.prevRate)}</td>
              </tr>
            ))}
            <tr className={s.totalRow}>
              <td>계</td><td /><td>{r.gates}</td>
              <td className={s.num}>{int(r.scans)}</td><td className={s.num}>{int(r.violations)}</td>
              <td className={s.num}>{fmt(r.rate)}</td><td className={s.num}>{fmt(r.prevRate)}</td>
            </tr>
          </tbody>
        </table>

        <h3 className={s.sec}>③ 무엇을: 보호구별 <small>(개, 본청 / 협력업체)</small></h3>
        <p className={s.line}>
          {r.gears.map((g, i) => (
            <span key={g.gear}>
              {i > 0 && " › "}<b>{GEAR_LABEL[g.gear]} {g.total}</b> ({g.hq} / {g.sub})
            </span>
          ))}
        </p>

        <h3 className={s.sec}>④ 언제: 태깅 시각별 <small>(위반 많은 순)</small></h3>
        <p className={s.line}>
          {r.slots.length === 0 ? "위반 없음" : r.slots.map((x, i) => (
            <span key={x.hour}>
              {i > 0 && " · "}{String(x.hour).padStart(2, "0")}시대 <b>{x.violations}건</b> ({x.pct}%)
            </span>
          ))}
        </p>

        <h3 className={s.sec}>⑤ 원인 및 조치</h3>
        <table className={s.action}>
          <tbody>
            <tr><th>원인</th><td /></tr>
            <tr><th>이번 달 조치</th><td /></tr>
            <tr><th>다음 달 할 일</th><td /></tr>
          </tbody>
        </table>

        <p className={s.writer}>작성일: {r.month.slice(0, 4)}. &nbsp; . &nbsp; . &nbsp;&nbsp; 작성: 안전관리자</p>
        <p className={s.foot}>
          위반율(1,000회당) = 위반 ÷ 판정 수 × 1,000. 위반은 1건, 보호구는 필수 미착용만 각각 집계 (게이트 b 보안경은 선택이라 제외).
          판정 불가 건은 판정 수에 포함하고, 안전관리자가 위반으로 확인한 건만 위반으로 셈.
          <br />가동일 = 검사 기록이 있는 날. 집계는 첫 검사일({r.start})부터. DB 목업 데이터.
        </p>
      </div>
    </div>
  );
}
