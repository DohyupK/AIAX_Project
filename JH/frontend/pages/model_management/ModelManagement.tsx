"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./ModelManagement.module.css";
import ModelForm from "./ModelForm";
import RobustnessDialog from "./RobustnessDialog";
import { METRIC_LABEL, PROCESS, PROCESS_METRICS, deployModel, fetchAccess, fetchModels, fetchRobustness, type AccessLevel, type Model, type Process, type RobustnessRow } from "./data";
import po from "../process_optimization/ProcessOptimization.module.css";
import { averageRobustness, orderRobustness, sortModels, type SortKey } from "./logic";

type Tab = "all" | Process;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "qc1", label: PROCESS.qc1.label },
  { key: "qc2", label: PROCESS.qc2.label },
  { key: "ppe", label: PROCESS.ppe.label },
];
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Idx" },
  { key: "name", label: "모델명" },
  { key: "process", label: "관리공정" },
  { key: "createdAt", label: "생성일" },
  { key: "version", label: "버전" },
];

// 성과지표 0~1 값을 소수점 둘째 자리로 (% 표기 안 함). 값 없으면 —
const num2 = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));
const DB_WRITE_PENDING = "DB 쓰기 계정 연결 전";
const ACCESS_LABEL: Record<AccessLevel, string> = { none: "접근 불가", read: "보기", edit: "보기 + 등록·배포" };

/**
 * Model Management — 공정별 모델 목록·성과지표 조회 (서버 DB, 읽기 전용)
 * 공정별 배포 모델 = 그 화면이 실제로 쓰는 모델 (품질 1차 → 품질 검사 1차 판정 등). 「배포」 버튼 → 서버 저장 → 각 화면 다음 판정부터 적용 (등록 저장은 아직)
 * 로그인 계정의 사번 → 서버 페이지 권한(관리자 = edit): none 화면 차단 / read 보기만 / edit 등록(+)·배포 안내 보임
 */
export default function ModelManagement() {
  const [access, setAccess] = useState<AccessLevel | null>(null); // null = 확인 중
  const [models, setModels] = useState<Model[] | null>(null); // null = 불러오는 중
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "id", asc: true });
  const [formOpen, setFormOpen] = useState(false);
  const [robustOpen, setRobustOpen] = useState(false);
  // 선택한 품질 2차 모델의 강건성 (카드 괄호 평균 + 팝업 표가 같이 씀). rows null = 불러오는 중
  const [robust, setRobust] = useState<{ id: number; rows: RobustnessRow[] | null; error: string } | null>(null);
  // 팝업 Esc 리스너가 매 렌더 다시 붙지 않도록 같은 함수 유지
  const closeRobust = useCallback(() => setRobustOpen(false), []);
  const [reload, setReload] = useState(0); // 배포 후 목록 다시 조회
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState<{ id: number; ok: boolean; text: string } | null>(null); // 그 모델을 고른 동안만 표시

  // 로그인 계정 권한 → (보기 권한이면) 모델 목록
  useEffect(() => {
    let alive = true; // 화면을 떠난 뒤 늦게 온 응답은 버림
    fetchAccess()
      .then((level) => {
        if (!alive) return;
        setAccess(level);
        if (level === "none") return setModels([]);
        return fetchModels().then((m) => alive && setModels(m));
      })
      .catch((e: unknown) => {
        console.error("[model_management] 권한·모델 목록 조회 실패", e);
        if (!alive) return;
        setLoadError("모델 목록을 불러오지 못했습니다. JH API 서버(127.0.0.1:8000)를 확인해 주세요.");
        setModels([]);
      });
    return () => { alive = false; };
  }, [reload]);

  async function onDeploy(m: Model) {
    const prev = models?.find((x) => x.process === m.process && x.deployed);
    const label = PROCESS[m.process].label;
    if (!window.confirm(`${m.name} ${m.version} 모델을 「${label}」에 배포할까요?${prev ? `\n기존 배포 모델 ${prev.name} ${prev.version} 는 해제됩니다.` : ""}`)) return;
    setDeploying(true);
    setDeployMsg(null);
    try {
      const { note } = await deployModel(m.id);
      setDeployMsg({ id: m.id, ok: true, text: `배포 완료 — ${note}` });
      setReload((n) => n + 1);
    } catch (e) {
      console.error("[model_management] 배포 실패", e);
      setDeployMsg({ id: m.id, ok: false, text: (e as Error).message });
    } finally {
      setDeploying(false);
    }
  }
  const canEdit = access === "edit";

  const visible = sortModels(
    // 전체 탭 = 현재 대시보드에 배포(적용)된 모델만 / 공정 탭 = 해당 공정 전 버전
    (models ?? []).filter((m) => (tab === "all" ? m.deployed : m.process === tab)),
    sort.key,
    sort.asc,
    PROCESS,
  );
  // 선택한 모델이 현재 탭에 없으면 첫 배포 모델 → 없으면 첫 모델
  const selected = visible.find((m) => m.id === selectedId) ?? visible.find((m) => m.deployed) ?? visible[0];

  // 품질 2차 모델을 고르면 강건성 1회 조회 (다른 공정은 데이터 없음)
  const robustId = selected?.process === "qc2" ? selected.id : null;
  useEffect(() => {
    if (robustId == null) return setRobust(null);
    let alive = true; // 모델을 빨리 바꿀 때 늦게 온 이전 모델 응답은 버림
    setRobust({ id: robustId, rows: null, error: "" });
    fetchRobustness(robustId)
      .then((r) => alive && setRobust({ id: robustId, rows: orderRobustness(r), error: "" }))
      .catch((e: unknown) => {
        console.error("[model_management] 강건성 조회 실패", e);
        if (alive) setRobust({ id: robustId, rows: [], error: "강건성 데이터를 불러오지 못했습니다. JH API 서버를 확인해 주세요." });
      });
    return () => { alive = false; };
  }, [robustId]);
  const robustAvg = robust?.id === robustId && robust.rows ? averageRobustness(robust.rows) : null;

  function changeTab(t: Tab) {
    setTab(t);
    setSelectedId(null);
  }

  function toggleSort(key: SortKey) {
    setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.accountRow}>
        {access && <span className={styles.muted}>권한: {ACCESS_LABEL[access]}</span>}
      </div>

      {access === "none" ? (
        <p className={styles.denied}>Model Management 접근 권한이 없습니다. (보기: 품질부·R&amp;D부·부서장·시스템개발부 / 수정: R&amp;D부 대리 이상·시스템개발부 과장 이상)</p>
      ) : (
      <>
      <div className={styles.tabs} role="tablist" aria-label="관리 공정 필터">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabOn : ""}`}
            onClick={() => changeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 폴더 본문 — 선택한 탭과 이어짐 */}
      <div className={styles.folder} role="tabpanel">
        <section className={styles.overview} aria-labelledby="overview-title">
          <h2 id="overview-title" className={styles.overviewTitle}>Overview</h2>
          {selected ? (
            <div className={styles.overviewGrid}>
              <dl className={styles.dl}>
                <dt>모델명</dt>
                <dd>{selected.name} <span className={styles.muted}>{selected.version}</span></dd>
                <dt>설명</dt>
                <dd>{selected.description || "-"}</dd>
                <dt>관리 공정(Code)</dt>
                <dd>{PROCESS[selected.process].label} ({PROCESS[selected.process].code})</dd>
                <dt>생성일</dt>
                <dd>{selected.createdAt}</dd>
                <dt>배포 여부</dt>
                <dd>
                  <span className={`${styles.badge} ${selected.deployed ? styles.badgeOn : ""}`}>
                    {selected.deployed ? "Y · 배포" : "N · 미배포"}
                  </span>
                  {canEdit && !selected.deployed && (
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.deployBtn}`} disabled={deploying}
                      onClick={() => onDeploy(selected)}>
                      {deploying ? "배포 중…" : "배포"}
                    </button>
                  )}
                  {deployMsg?.id === selected.id && (
                    <p className={deployMsg.ok ? styles.deployOk : styles.deployErr} role={deployMsg.ok ? "status" : "alert"}>{deployMsg.text}</p>
                  )}
                </dd>
                {selected.deployed && (
                  <>
                    <dt>사용 화면</dt>
                    <dd>{PROCESS[selected.process].usedBy}</dd>
                  </>
                )}
                {selected.fileName && (
                  <>
                    <dt>모델 파일</dt>
                    <dd>{selected.fileName}</dd>
                  </>
                )}
              </dl>
              <dl className={styles.dl}>
                <dt>성과지표</dt>
                <dd>
                  {/* 강건성(손상 조건별 성능)은 품질 2차 모델만 */}
                  {selected.process === "qc2" && (
                    <div className={styles.metricsHead}>
                      <button type="button" className={styles.btn} onClick={() => setRobustOpen(true)}>강건성</button>
                    </div>
                  )}
                  <div className={styles.metrics}>
                    {/* 공정마다 지표 4개가 다름 — 품질 1차: PR-AUC·Recall·Precision·F1 */}
                    {PROCESS_METRICS[selected.process].map((k) => (
                      <span key={k}>
                        <small>{METRIC_LABEL[k]}</small>
                        <b>{num2(selected.metrics[k])}</b>
                        {/* 괄호 = 강건성 조건 평균 (팝업 「조건 평균」과 같은 값) */}
                        {robustAvg && k !== "prAuc" && k !== "map50" && (
                          <em className={styles.robustAvg} title={`강건성 평균 (손상 조건 ${robust!.rows!.length}개)`}>({num2(robustAvg[k])})</em>
                        )}
                      </span>
                    ))}
                  </div>
                </dd>
              </dl>
            </div>
          ) : (
            <p className={styles.muted}>
              {models === null ? "불러오는 중…" : loadError || "등록된 모델이 없습니다. (서버 DB 모델 레지스트리)"}
              {models !== null && !loadError && tab === "qc1" && " — 품질 검사 1차는 등록 전까지 기본 모델(DieCasting_XGB_20261114_09)을 씁니다."}
            </p>
          )}
        </section>

        {canEdit && (
        <div className={styles.addRow}>
          {/* 등록 폼은 입력 검사까지 — DB 저장은 쓰기 계정 연결 후 */}
          <button
            type="button"
            className={styles.addBtn}
            aria-label="모델 등록"
            title={`모델 등록 (저장: ${DB_WRITE_PENDING})`}
            onClick={() => setFormOpen(true)}
          >
            +
          </button>
        </div>
        )}

        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} aria-sort={sort.key === c.key ? (sort.asc ? "ascending" : "descending") : "none"}>
                  <button type="button" className={styles.sortBtn} onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <span className={styles.sortIcon} aria-hidden>
                      {sort.key === c.key ? (sort.asc ? "▲" : "▼") : "▲▼"}
                    </span>
                  </button>
                </th>
              ))}
              <th>배포</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr
                key={m.id}
                className={`${m.deployed ? styles.rowDeployed : ""} ${m.id === selected?.id ? styles.rowOn : ""}`}
                onClick={() => setSelectedId(m.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelectedId(m.id))}
                tabIndex={0}
                aria-selected={m.id === selected?.id}
              >
                <td>{m.id}</td>
                <td>{m.name}</td>
                <td>{PROCESS[m.process].label}</td>
                <td>{m.createdAt}</td>
                <td>{m.version}</td>
                <td>{m.deployed ? <span className={`${styles.badge} ${styles.badgeOn}`}>배포</span> : <span className={styles.muted}>-</span>}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>{tab === "all" ? "배포된 모델이 없습니다." : "해당 공정의 모델이 없습니다."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      </>
      )}

      {formOpen && canEdit && <ModelForm process={tab === "all" ? undefined : tab} onClose={() => setFormOpen(false)} />}
      {robustOpen && selected && robust?.id === selected.id && (
        <RobustnessDialog model={selected} rows={robust.rows} error={robust.error} onClose={closeRobust} />
      )}
    </div>
  );
}
