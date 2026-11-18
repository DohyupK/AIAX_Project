"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./PpeViolation.module.css";
import ScanView from "./ScanView";
import ViolationReports from "./ViolationReports";
import { fetchScanDates, fetchScanRecords, type ScanRecord } from "./data";
import { GEAR_LABEL, gearStatus, missingGear, violationMessage, type Gate, type Gear, type GearStatus } from "./rules";

type Filter = "all" | "pass" | "fail" | "check";
/** 화면 판정: 통과 / 위반 / 확인 필요(카메라 판정 불가) */
type Status = "pass" | "fail" | "check";
type SortKey = "time_desc" | "time_asc" | "company" | "gate" | "result";

const SORT_LABEL: Record<SortKey, string> = {
  time_desc: "시간 최신순",
  time_asc: "시간 오래된순",
  company: "업체명순",
  gate: "Gate순",
  result: "위반 먼저",
};
const STATUS_LABEL: Record<Status, string> = { pass: "통과", fail: "위반", check: "확인 필요" };
const STATUS_RANK: Record<Status, number> = { fail: 0, check: 1, pass: 2 };
const GEAR_MARK: Record<GearStatus, string> = { worn: "✓", missing: "✕", optional_missing: "–", unknown: "?" };
const GEAR_TEXT: Record<GearStatus, string> = { worn: "착용", missing: "미착용", optional_missing: "선택 · 미착용", unknown: "판정 불가" };
/** 한 번에 조회하는 기간 상한 — 서버 MAX_RANGE_DAYS 와 같게 */
const MAX_RANGE_DAYS = 92;
/** 'YYYY-MM-DD' 두 날짜 사이 일수 (양 끝 포함). UTC 기준이라 서머타임 영향 없음 */
const rangeDays = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1;
const LOAD_ERROR ="검사 기록을 불러오지 못했습니다. JH API 서버(127.0.0.1:8000)를 확인해 주세요.";

type Row = ScanRecord & { missing: Gear[]; status: Status };
// 결과는 DB 판정(result) 그대로, 미착용 목록은 게이트 규칙으로 계산 (판정 불가면 빈 목록)
const toRow = (r: ScanRecord): Row => ({
  ...r,
  missing: r.result === "undecidable" ? [] : missingGear(r.gate, r.detected),
  status: r.result === "pass" ? "pass" : r.result === "violation" ? "fail" : "check",
});
const badgeClass = (st: Status) => (st === "pass" ? styles.ok : st === "fail" ? styles.bad : styles.grey);

// 업체 단위 = 본사(부서는 하위 선택) 또는 하청 업체명. 본사 사원의 company 는 부서명
const HQ = "본사";
const orgOf = (r: Row) => (r.companyType === "본사" ? HQ : r.company);
/** org·dept 선택에 맞는 기록인지 (dept 는 본사일 때만 적용, "all" = 전체) */
const inOrg = (r: Row, org: string, dept: string) =>
  (org === "all" || orgOf(r) === org) && (org !== HQ || dept === "all" || r.company === dept);
const sortKo = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "ko"));

/** 본사 부서 필터 버튼 — 업체에서 「본사」를 골랐을 때만 표시 */
function DeptButtons({ depts, value, onChange }: { depts: string[]; value: string; onChange: (d: string) => void }) {
  return (
    <div className={`${styles.filters} ${styles.deptFilters}`} role="group" aria-label="본사 부서 필터">
      {[["all", "전체 부서"], ...depts.map((d) => [d, d])].map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`${styles.filterBtn} ${value === key ? styles.filterOn : ""}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const stamp = (r: Row) => `${r.date} ${r.time}`;
/** 목록용 짧은 시각 'MM-DD HH:mm' (기간이 여러 날일 수 있음) */
const when = (r: Row) => `${r.date.slice(5)} ${r.time.slice(0, 5)}`;
// 같은 값이면 최신순으로 이어서 정렬
const SORTERS: Record<SortKey, (a: Row, b: Row) => number> = {
  time_desc: (a, b) => stamp(b).localeCompare(stamp(a)),
  time_asc: (a, b) => stamp(a).localeCompare(stamp(b)),
  company: (a, b) => a.company.localeCompare(b.company, "ko") || SORTERS.time_desc(a, b),
  gate: (a, b) => a.gate.localeCompare(b.gate) || SORTERS.time_desc(a, b),
  result: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || SORTERS.time_desc(a, b),
};

/**
 * 보호구 착용 위반 대시보드 (/safety/ppe-violation) — 안전 작업 관리자(소장)용
 * 게이트 카드 태깅 → 카메라 SCAN(DL) → 게이트별 필수 장구 확인 → 개찰구 개방/잠금 기록을 보여줌
 * 데이터: data.ts → JH API /api/ppe (판정 ai.ppe_check + 출입·소속 lake 사본). 하루 단위로 조회
 */
export default function PpeViolationDashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [gate, setGate] = useState<Gate | "all">("all");
  const [orgFilter, setOrgFilter] = useState("all");   // 표: 전체 / 본사 / 하청 업체명
  const [deptFilter, setDeptFilter] = useState("all"); // 표: 본사일 때 부서
  const [sort, setSort] = useState<SortKey>("time_desc");
  // 달력에서 고르는 기간 (양 끝 포함). bounds = 첫·마지막 기록일 (달력 선택 범위)
  const [bounds, setBounds] = useState({ min: "", max: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // 시작일 칸에 고른 값 — 종료일을 골라야 from 에 적용되어 조회됨
  const [pickFrom, setPickFrom] = useState("");
  // 종료일 칸 값 — 시작일을 고르면 비워서, 같은 날을 다시 골라도 적용되게 함 (값이 같으면 change 가 안 일어남)
  const [pickTo, setPickTo] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null); // null = 불러오는 중
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | undefined>();
  // 회사 출입 현황 칸에서 보는 업체·부서 — 기본은 선택한 기록의 소속, 행을 바꾸면 그 소속으로 돌아감
  const [viewOrg, setViewOrg] = useState("");
  const [viewDept, setViewDept] = useState("all");
  const [reportsOpen, setReportsOpen] = useState(false);

  // 처음: 기록 있는 날짜 목록(최신순) → 기간 = 가장 최근 날 하루
  useEffect(() => {
    fetchScanDates()
      .then((d) => {
        if (!d[0]) return setRows([]);
        setBounds({ min: d[d.length - 1], max: d[0] });
        setFrom(d[0]);
        setPickFrom(d[0]);
        setPickTo(d[0]);
        setTo(d[0]);
      })
      .catch((e: unknown) => {
        console.error("[ppe_violation] 검사 날짜 조회 실패", e);
        setError(LOAD_ERROR);
      });
  }, []);

  // 잘못된 기간이면 조회하지 않고 안내 (서버도 같은 기준으로 400)
  const rangeError = !from || !to ? "" : from > to ? "시작일이 종료일보다 늦습니다." : rangeDays(from, to) > MAX_RANGE_DAYS ? `기간은 최대 ${MAX_RANGE_DAYS}일까지 고를 수 있습니다.` : "";

  // 기간을 바꾸면 그 기간 기록 (늦게 온 이전 기간 응답은 버림)
  useEffect(() => {
    if (!from || !to || rangeError) return;
    let alive = true;
    setRows(null);
    setError("");
    fetchScanRecords(from, to)
      .then((recs) => {
        if (!alive) return;
        const next = recs.map(toRow);
        setRows(next);
        if (next[0]) selectRow(next[0]);
        else setSelectedId(undefined);
        setOrgFilter("all");
        setDeptFilter("all");
      })
      .catch((e: unknown) => {
        console.error("[ppe_violation] 검사 기록 조회 실패", from, to, e);
        if (alive) setError(LOAD_ERROR);
      });
    return () => { alive = false; };
  }, [from, to, rangeError]);

  // 기간이 잘못됐으면 이전 기간 기록을 보이지 않음
  const all = useMemo(() => (rangeError ? [] : rows ?? []), [rows, rangeError]);
  // 업체 목록 = 본사(기간 내 사원 기록이 있으면) + 하청 업체, 부서 목록 = 기간 내 본사 기록의 부서
  const orgs = useMemo(() => {
    const vendors = sortKo(all.filter((r) => r.companyType !== "본사").map((r) => r.company));
    return all.some((r) => r.companyType === "본사") ? [HQ, ...vendors] : vendors;
  }, [all]);
  const depts = useMemo(() => sortKo(all.filter((r) => r.companyType === "본사").map((r) => r.company)), [all]);

  function selectRow(r: Row) {
    setSelectedId(r.id);
    setViewOrg(orgOf(r));
    setViewDept(r.companyType === "본사" ? r.company : "all");
  }
  /** 시작일만 고르면 조회하지 않고 종료일 칸을 비움 (다음은 종료일을 고를 차례) */
  function pickStart(start: string) {
    setPickFrom(start);
    setPickTo("");
  }
  /** 종료일을 고르면 그때 시작일 칸 값과 함께 기간 적용 → 조회 */
  function applyRange(end: string) {
    setPickTo(end);
    setFrom(pickFrom);
    setTo(end);
  }
  function changeOrgFilter(org: string) {
    setOrgFilter(org);
    setDeptFilter("all");
  }
  function changeViewOrg(org: string) {
    setViewOrg(org);
    setViewDept("all");
  }

  const selected: Row | undefined = all.find((r) => r.id === selectedId);
  // 게이트·업체(·부서) 필터 → 결과 필터 → 정렬. 결과 버튼 건수는 게이트·업체·부서 기준
  const scopedRows = all.filter((r) => (gate === "all" || r.gate === gate) && inOrg(r, orgFilter, deptFilter));
  const visible = scopedRows.filter((r) => filter === "all" || r.status === filter).sort(SORTERS[sort]);
  const counts: Record<Filter, number> = {
    all: scopedRows.length,
    pass: scopedRows.filter((r) => r.status === "pass").length,
    fail: scopedRows.filter((r) => r.status === "fail").length,
    check: scopedRows.filter((r) => r.status === "check").length,
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={`${styles.filterBtn} ${styles.primaryBtn}`} onClick={() => setReportsOpen(true)}>
          위반 보고서
        </button>
      </div>
      {reportsOpen && <ViolationReports onClose={() => setReportsOpen(false)} />}

      {rangeError || error ? (
        <section className={styles.card} role="alert">{rangeError || error}</section>
      ) : rows === null ? (
        <section className={styles.card}>불러오는 중…</section>
      ) : selected ? (
        <Detail
          row={selected} rows={all} orgs={orgs} depts={depts}
          org={viewOrg} dept={viewDept} onOrgChange={changeViewOrg} onDeptChange={setViewDept}
        />
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
                ["check", "확인 필요"],
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
          {/* 브라우저 기본 달력 — 칸을 누르면 달력이 뜸. 고를 수 있는 날 = 첫~마지막 기록일 */}
          <div className={styles.dateRange} role="group" aria-label="조회 기간">
            <input
              type="date" className={styles.select} value={pickFrom} min={bounds.min} max={bounds.max}
              onChange={(e) => e.target.value && pickStart(e.target.value)} aria-label="시작일"
            />
            <span aria-hidden="true">~</span>
            <input
              type="date" className={styles.select} value={pickTo} min={bounds.min} max={bounds.max}
              onChange={(e) => e.target.value && applyRange(e.target.value)} aria-label="종료일"
            />
          </div>
          <select className={styles.select} value={orgFilter} onChange={(e) => changeOrgFilter(e.target.value)} aria-label="업체 필터">
            <option value="all">전체 업체</option>
            {orgs.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {orgFilter === HQ && <DeptButtons depts={depts} value={deptFilter} onChange={setDeptFilter} />}
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
          <div className={styles.filters} role="group" aria-label="게이트 필터">
            {(
              [
                ["all", "All Gates"],
                ["a", "Gate a"],
                ["b", "Gate b"],
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
              <th>일시</th>
              <th>사번·카드</th>
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
                <td>{when(r)}</td>
                <td>{r.userId}</td>
                <td>{r.gate}</td>
                <td>{r.company}</td>
                <td className={r.status === "fail" ? styles.badText : styles.muted}>
                  {r.status === "fail" ? r.missing.map((g) => GEAR_LABEL[g]).join(", ") : "-"}
                </td>
                <td className={styles.right}>
                  <span className={`${styles.badge} ${badgeClass(r.status)}`}>{STATUS_LABEL[r.status]}</span>
                </td>
              </tr>
            ))}
            {rows !== null && visible.length === 0 && (
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
function Detail({ row, rows, orgs, depts, org, dept, onOrgChange, onDeptChange }: {
  row: Row; rows: Row[]; orgs: string[]; depts: string[]; org: string; dept: string;
  onOrgChange: (o: string) => void; onDeptChange: (d: string) => void;
}) {
  const gears = gearStatus(row.gate, row.detected, row.unknown);
  // 기간 내 고른 업체(본사면 부서까지) 전체 기록 기준 (표의 게이트·업체·결과 필터와 무관), 최신순
  const companyRows = rows.filter((r) => inOrg(r, org, dept)).sort(SORTERS.time_desc);
  const orgLabel = org === HQ && dept !== "all" ? `${HQ} · ${dept}` : org;
  const companyPass = companyRows.filter((r) => r.status === "pass").length;
  const companyFail = companyRows.filter((r) => r.status === "fail").length;

  return (
    <section className={`${styles.card} ${styles.detail}`} aria-label="선택한 검색 기록 상세">
      <div className={styles.scanCol}>
        <div className={styles.scanHead}>
          <span>Gate {row.gate} 검색대</span>
          <span>{row.date} {row.time}</span>
        </div>
        <ScanView gears={gears} caption={`GATE ${row.gate} · 정문`} />
        <div className={styles.legend}>
          <span><i className={styles.ok} /> 충족</span>
          <span><i className={styles.bad} /> 미충족</span>
          <span><i className={styles.grey} /> 선택 · 판정 불가</span>
        </div>
      </div>

      <div className={styles.info}>
        {row.status === "pass" ? (
          <div className={`${styles.banner} ${styles.bannerOk}`} role="status">
            <b>통과 · 개찰구 개방</b>
            <span>필수 안전장구를 모두 착용했습니다.</span>
          </div>
        ) : row.status === "check" ? (
          <div className={`${styles.banner} ${styles.grey}`} role="status">
            <b>판정 불가 · 안전관리자 확인 필요</b>
            <span>
              {row.manualResult
                ? `안전관리자 확인 결과: ${row.manualResult === "pass" ? "통과" : "위반"} (${row.manualBy ?? "-"})`
                : "카메라가 장구를 판정하지 못했습니다. 아직 확인 전입니다."}
            </span>
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
              <dt>{row.companyType === "본사" ? "사번" : "카드"}</dt><dd>{row.userId}</dd>
              <dt>태깅 시각</dt><dd>{row.date} {row.time}</dd>
              <dt>게이트</dt><dd>{row.gate}</dd>
            </dl>
          </div>
          <div className={`${styles.box} ${styles.areaCompany}`}>
            <div className={styles.boxHead}>
              <h2 className={styles.boxTitle}>회사 출입 현황</h2>
              <div className={styles.boxActions}>
                <select
                  className={styles.select}
                  value={org}
                  onChange={(e) => onOrgChange(e.target.value)}
                  aria-label="회사 선택"
                >
                  {orgs.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            {org === HQ && <DeptButtons depts={depts} value={dept} onChange={onDeptChange} />}
            <p className={styles.companyName}>
              {orgLabel} <span className={styles.sub}>({org === HQ ? "본사" : "하청업체"})</span>
            </p>
            <div className={styles.stats}>
              <div className={styles.stat}><span>전체</span><b>{companyRows.length}</b></div>
              <div className={`${styles.stat} ${styles.statOk}`}><span>통과</span><b>{companyPass}</b></div>
              <div className={`${styles.stat} ${styles.statBad}`}><span>위반</span><b>{companyFail}</b></div>
            </div>
            {/* 인원 목록 — 보기 전용, 최신순. 길면 칸 안에서만 스크롤 */}
            <div className={styles.peopleWrap}>
              <ul className={styles.people} aria-label={`${orgLabel} 출입 기록`}>
                {companyRows.map((r) => (
                  <li key={r.id} className={styles.person}>
                    <span className={styles.personId}>{r.userId}</span>
                    <span className={styles.muted}>{when(r)}</span>
                    <span className={styles.muted}>Gate {r.gate}</span>
                    <span className={styles.personMissing}>
                      {r.status === "fail" ? r.missing.map((g) => GEAR_LABEL[g]).join(", ") : ""}
                    </span>
                    <span className={`${styles.badge} ${badgeClass(r.status)}`}>{STATUS_LABEL[r.status]}</span>
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
                {GEAR_MARK[status]} {GEAR_LABEL[gear]} {GEAR_TEXT[status]}
              </span>
            ))}
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
