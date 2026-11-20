"use client";

import { useMemo, useState } from "react";
import type { ChatSource } from "./sources";
import s from "./HyejinBot.module.css";

/** 답변에서 인용 ID 추출 → 해당 출처를 위에 펼침 */
function citedIds(answer: string): Set<string> {
  const ids = new Set<string>();
  const re = /\[(DOC-\d+|ALERT-[^\]]+|QKPI-[^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    ids.add(m[1].toUpperCase());
  }
  return ids;
}

function isCited(docNo: string, cited: Set<string>): boolean {
  const id = (docNo || "").toUpperCase();
  if (cited.has(id)) return true;
  for (const c of cited) {
    if (id.startsWith(c) || c.startsWith(id)) return true;
  }
  return false;
}

function SourceItem({ src, open }: { src: ChatSource; open: boolean }) {
  const [expanded, setExpanded] = useState(open);
  return (
    <li>
      <button
        type="button"
        className={s.srcToggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={s.srcTitle}>
          {src.doc_no} · {src.title}
        </span>
        <span className={s.srcChevron}>{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className={s.srcBody}>
          <div className={s.srcMeta}>
            {src.kind === "process_alert" ? (
              <>
                관리도 알림
                {src.category ? ` · ${src.category}` : ""}
                {src.file_name ? ` · ${src.file_name}` : ""}
              </>
            ) : src.kind === "quality_kpi" ? (
              <>
                품질 검사 KPI
                {src.line ? ` · ${src.line}` : ""}
                {src.file_name ? ` · ${src.file_name}` : ""}
              </>
            ) : (
              <>
                {src.file_name}
                {src.category ? ` · ${src.category}` : ""} · chunk {src.chunk_no} · score{" "}
                {src.score}
              </>
            )}
          </div>
          {src.snippet && <p className={s.snippet}>{src.snippet}</p>}
          {src.kind === "company_document" && src.file_url ? (
            <a className={s.fileLink} href={src.file_url} target="_blank" rel="noreferrer">
              원문 다운로드
            </a>
          ) : src.kind === "process_alert" ? (
            <a className={s.fileLink} href="/casting/process-optimization">
              공정 최적화 · 관리도 알림
            </a>
          ) : src.kind === "quality_kpi" ? (
            <a className={s.fileLink} href="/casting/quality-inspection">
              품질 검사 대시보드
            </a>
          ) : null}
        </div>
      )}
    </li>
  );
}

/** kind별 접힘 + 인용 출처 우선 펼침 */
export default function SourceList({
  sources,
  answer,
}: {
  sources: ChatSource[];
  answer: string;
}) {
  const cited = useMemo(() => citedIds(answer), [answer]);
  const counts = useMemo(() => {
    let docs = 0,
      alerts = 0,
      kpi = 0;
    for (const src of sources) {
      if (src.kind === "process_alert") alerts++;
      else if (src.kind === "quality_kpi") kpi++;
      else docs++;
    }
    return { docs, alerts, kpi };
  }, [sources]);

  const [panelOpen, setPanelOpen] = useState(cited.size > 0);

  const ordered = useMemo(() => {
    const hit: ChatSource[] = [];
    const rest: ChatSource[] = [];
    for (const src of sources) {
      if (isCited(src.doc_no, cited)) hit.push(src);
      else rest.push(src);
    }
    return [...hit, ...rest];
  }, [sources, cited]);

  if (sources.length === 0) return null;

  const summary = [
    counts.docs ? `문서 ${counts.docs}` : null,
    counts.alerts ? `알림 ${counts.alerts}` : null,
    counts.kpi ? `KPI ${counts.kpi}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={s.sourcesWrap}>
      <button
        type="button"
        className={s.sourcesSummary}
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((v) => !v)}
      >
        출처 {summary || `${sources.length}건`} {panelOpen ? "▾" : "▸"}
      </button>
      {panelOpen && (
        <ul className={s.sources} aria-label="출처">
          {ordered.map((src) => (
            <SourceItem
              key={`${src.kind}-${src.doc_no}-${src.chunk_no}-${src.file_name}`}
              src={src}
              open={isCited(src.doc_no, cited)}
            />
          ))}
        </ul>
      )}
      {!panelOpen && cited.size > 0 && (
        <p className={s.citedHint}>인용 {cited.size}건 — 펼쳐서 확인</p>
      )}
    </div>
  );
}
