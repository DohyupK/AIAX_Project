"use client";
import { useState } from "react";
import styles from "./ModelManagement.module.css";
import ModelForm from "./ModelForm";
import { MODELS, PROCESS, type Model, type Process } from "./data";
import { sortModels, type SortKey } from "./logic";

type Tab = "all" | Process;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "optimization", label: PROCESS.optimization.label },
  { key: "quality", label: PROCESS.quality.label },
  { key: "safety", label: PROCESS.safety.label },
];
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Idx" },
  { key: "name", label: "모델명" },
  { key: "process", label: "관리공정" },
  { key: "createdAt", label: "생성일" },
  { key: "version", label: "버전" },
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Model Management — 공정별 모델 목록·성과지표 조회 + 신규 모델 등록 */
export default function ModelManagement() {
  // ponytail: 등록한 모델은 화면 메모리에만 있음(새로고침 시 사라짐). 레지스트리 API 연동 시 교체
  const [models, setModels] = useState<Model[]>(MODELS);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "id", asc: true });
  const [formOpen, setFormOpen] = useState(false);

  const visible = sortModels(
    models.filter((m) => tab === "all" || m.process === tab),
    sort.key,
    sort.asc,
    PROCESS,
  );
  // 선택한 모델이 현재 탭에 없으면 첫 배포 모델 → 없으면 첫 모델
  const selected = visible.find((m) => m.id === selectedId) ?? visible.find((m) => m.deployed) ?? visible[0];

  function changeTab(t: Tab) {
    setTab(t);
    setSelectedId(null);
  }

  function toggleSort(key: SortKey) {
    setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  }

  function addModel(m: Omit<Model, "id">) {
    const id = Math.max(0, ...models.map((x) => x.id)) + 1;
    setModels((list) => [...list, { ...m, id }]);
    setSelectedId(id);
    // 등록한 공정 탭이 아니면 보이도록 해당 탭(또는 전체 유지)으로 이동
    if (tab !== "all" && tab !== m.process) setTab(m.process);
    setFormOpen(false);
  }

  return (
    <div className={styles.page}>
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
                </dd>
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
                  <div className={styles.metrics}>
                    <span><small>Accuracy</small><b>{pct(selected.metrics.accuracy)}</b></span>
                    <span><small>Recall</small><b>{pct(selected.metrics.recall)}</b></span>
                    <span><small>Precision</small><b>{pct(selected.metrics.precision)}</b></span>
                    <span><small>F1-Score</small><b>{pct(selected.metrics.f1)}</b></span>
                  </div>
                </dd>
              </dl>
            </div>
          ) : (
            <p className={styles.muted}>등록된 모델이 없습니다.</p>
          )}
        </section>

        <div className={styles.addRow}>
          <button type="button" className={styles.addBtn} aria-label="모델 등록" title="모델 등록" onClick={() => setFormOpen(true)}>
            +
          </button>
        </div>

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
                <td colSpan={6} className={styles.empty}>해당 공정의 모델이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && <ModelForm onClose={() => setFormOpen(false)} onSubmit={addModel} />}
    </div>
  );
}
