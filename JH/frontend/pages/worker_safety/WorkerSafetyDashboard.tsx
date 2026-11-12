"use client";
import { useState } from "react";
import styles from "./WorkerSafety.module.css";
import ScanView from "./ScanView";
import { SCAN_RECORDS, type ScanRecord } from "./data";
import { GEAR_LABEL, gearStatus, missingGear, violationMessage, type Gate } from "./rules";
import { openCompanyReport, type ReportRow } from "./report";

type Filter = "all" | "pass" | "fail";

// 기록별 판정 결과를 한 번만 계산
const ROWS: ReportRow[] = SCAN_RECORDS.map((r) => {
  const missing = missingGear(r.gate, r.detected);
  return { ...r, missing, pass: missing.length === 0 };
});
type Row = ReportRow;
const COMPANIES = [...new Set(ROWS.map((r) => r.company))];

/**
 * 작업자 안전 관리 대시보드 (/safety/worker-safety) — 안전 작업 관리자(소장)용
 * 게이트 카드 태깅 → 카메라 SCAN(DL) → 게이트별 필수 장구 확인 → 개찰구 개방/잠금 기록을 보여줌
 */
export default function WorkerSafetyDashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [gate, setGate] = useState<Gate | "all">("all");
  const [selectedId, setSelectedId] = useState<number | undefined>(ROWS[0]?.id);
  // 회사 출입 현황 칸에서 보는 회사 — 기본은 선택한 기록의 회사, 행을 바꾸면 그 회사로 돌아감
  const [company, setCompany] = useState(ROWS[0]?.company ?? "");

  function selectRow(r: Row) {
    setSelectedId(r.id);
    setCompany(r.company);
  }

  const selected: Row | undefined = ROWS.find((r) => r.id === selectedId);
  // 게이트 필터 → 결과 필터 순서. 결과 버튼 건수는 선택한 게이트 기준
  const gateRows = ROWS.filter((r) => gate === "all" || r.gate === gate);
  const visible = gateRows.filter((r) => filter === "all" || (filter === "pass") === r.pass);
  const passCount = gateRows.filter((r) => r.pass).length;
  const counts: Record<Filter, number> = { all: gateRows.length, pass: passCount, fail: gateRows.length - passCount };

  return (
    <div className={styles.page}>
      {selected ? (
        <Detail row={selected} company={company} onCompanyChange={setCompany} />
      ) : (
        <section className={styles.card}>표시할 기록이 없습니다.</section>
      )}

      <section className={styles.card} aria-label="검색대 기록">
        <div className={styles.listHead}>
          <div className={styles.filters} role="group" aria-label="결과 필터">
            {(
              [
                ["all", "전체"],
                ["pass", "통과"],
                ["fail", "위반"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.filterBtn} ${filter === key ? styles.filterOn : ""}`}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label} <b>{counts[key]}</b>
              </button>
            ))}
          </div>
          <span className={`${styles.sub} ${styles.hint}`}>행을 누르면 위에 상세가 표시됩니다.</span>
          <div className={styles.filters} role="group" aria-label="게이트 필터">
            {(
              [
                ["all", "All Gates"],
                ["A", "Gate A"],
                ["B", "Gate B"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.filterBtn} ${gate === key ? styles.filterOn : ""}`}
                aria-pressed={gate === key}
                onClick={() => setGate(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>시간</th>
              <th>태깅 정보</th>
              <th>Gate</th>
              <th>업체</th>
              <th>위반 항목</th>
              <th className={styles.right}>결과</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id}
                className={r.id === selectedId ? styles.rowOn : undefined}
                onClick={() => selectRow(r)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), selectRow(r))}
                tabIndex={0}
                aria-selected={r.id === selectedId}
              >
                <td>{r.time.slice(0, 5)}</td>
                <td>{r.userId}</td>
                <td>{r.gate}</td>
                <td>{r.company}</td>
                <td className={r.pass ? styles.muted : styles.badText}>
                  {r.pass ? "-" : r.missing.map((g) => GEAR_LABEL[g]).join(", ")}
                </td>
                <td className={styles.right}>
                  <span className={`${styles.badge} ${r.pass ? styles.ok : styles.bad}`}>{r.pass ? "통과" : "위반"}</span>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>해당 기록이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** 선택한 기록의 촬영 이미지 + 판정 상세 */
function Detail({ row, company, onCompanyChange }: { row: Row; company: string; onCompanyChange: (c: string) => void }) {
  const gears = gearStatus(row.gate, row.detected);
  // 회사 전체 기록 기준 (게이트·결과 필터와 무관)
  const companyRows = ROWS.filter((r) => r.company === company);
  const companyPass = companyRows.filter((r) => r.pass).length;

  function printReport() {
    if (!openCompanyReport(company, companyRows)) {
      console.warn("[worker_safety] 보고서 창 열기 실패 (팝업 차단)");
      alert("보고서 창이 차단되었습니다. 브라우저 주소창의 팝업 차단을 해제한 뒤 다시 눌러 주세요.");
    }
  }
  return (
    <section className={`${styles.card} ${styles.detail}`} aria-label="선택한 검색 기록 상세">
      <div className={styles.scanCol}>
        <div className={styles.scanHead}>
          <span>Gate {row.gate} 검색대</span>
          <span>{row.time}</span>
        </div>
        <ScanView gears={gears} caption={`GATE ${row.gate} · ${row.camera}`} />
        <div className={styles.legend}>
          <span><i className={styles.ok} /> 충족</span>
          <span><i className={styles.bad} /> 미충족</span>
          <span><i className={styles.grey} /> 선택</span>
        </div>
      </div>

      <div className={styles.info}>
        {row.pass ? (
          <div className={`${styles.banner} ${styles.bannerOk}`} role="status">
            <b>통과 · 개찰구 개방</b>
            <span>필수 안전장구를 모두 착용했습니다.</span>
          </div>
        ) : (
          <div className={`${styles.banner} ${styles.bannerBad}`} role="alert">
            <b>위반 · 개찰구 잠금 유지</b>
            <span>음성 안내: &quot;{violationMessage(row.missing)}&quot;</span>
          </div>
        )}

        {/* 2칸 × 2줄: 왼쪽 = 태깅 정보·안전장구 확인, 오른쪽 = 회사 출입 현황(두 줄 합침) */}
        <div className={styles.infoGrid}>
          <div className={`${styles.box} ${styles.areaTag}`}>
            <h2 className={styles.boxTitle}>태깅 정보</h2>
            <dl className={styles.dl}>
              <dt>회사</dt><dd>{row.company}</dd>
              <dt>구분</dt><dd>{row.companyType}</dd>
              <dt>유저 ID</dt><dd>{row.userId}</dd>
              <dt>태깅 시각</dt><dd>{row.time}</dd>
              <dt>게이트</dt><dd>{row.gate}</dd>
            </dl>
          </div>
          <div className={`${styles.box} ${styles.areaCompany}`}>
            <div className={styles.boxHead}>
              <h2 className={styles.boxTitle}>회사 출입 현황</h2>
              <div className={styles.boxActions}>
                <select
                  className={styles.select}
                  value={company}
                  onChange={(e) => onCompanyChange(e.target.value)}
                  aria-label="회사 선택"
                >
                  {COMPANIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button type="button" className={`${styles.filterBtn} ${styles.smallBtn}`} onClick={printReport}>
                  보고서
                </button>
              </div>
            </div>
            <p className={styles.companyName}>
              {company} <span className={styles.sub}>({companyRows[0]?.companyType ?? "-"})</span>
            </p>
            <div className={styles.stats}>
              <div className={styles.stat}><span>전체</span><b>{companyRows.length}</b></div>
              <div className={`${styles.stat} ${styles.statOk}`}><span>통과</span><b>{companyPass}</b></div>
              <div className={`${styles.stat} ${styles.statBad}`}><span>위반</span><b>{companyRows.length - companyPass}</b></div>
            </div>
            {/* 인원 목록 — 보기 전용, 최신순(ROWS 순서). 길면 칸 안에서만 스크롤 */}
            <div className={styles.peopleWrap}>
              <ul className={styles.people} aria-label={`${company} 출입 기록`}>
                {companyRows.map((r) => (
                  <li key={r.id} className={styles.person}>
                    <span className={styles.personId}>{r.userId}</span>
                    <span className={styles.muted}>{r.time.slice(0, 5)}</span>
                    <span className={styles.muted}>Gate {r.gate}</span>
                    <span className={styles.personMissing}>
                      {r.pass ? "" : r.missing.map((g) => GEAR_LABEL[g]).join(", ")}
                    </span>
                    <span className={`${styles.badge} ${r.pass ? styles.ok : styles.bad}`}>{r.pass ? "통과" : "위반"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        <div className={`${styles.box} ${styles.areaGear}`}>
          <h2 className={styles.boxTitle}>안전장구 확인 · Gate {row.gate} 기준</h2>
          <div className={styles.gearChips}>
            {gears.map(({ gear, status }) => (
              <span
                key={gear}
                className={`${styles.gearChip} ${status === "worn" ? styles.ok : status === "missing" ? styles.bad : styles.grey}`}
              >
                {status === "worn" ? "✓" : status === "missing" ? "✕" : "–"} {GEAR_LABEL[gear]}{" "}
                {status === "optional_missing" ? "선택 · 미착용" : status === "worn" ? "착용" : "미착용"}
              </span>
            ))}
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
