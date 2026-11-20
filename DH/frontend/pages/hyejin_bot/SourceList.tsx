"use client";

import { useMemo, useState } from "react";
import type { ChatSource } from "./sources";
import s from "./HyejinBot.module.css";

/** 답변에서 인용 ID — 정렬용(인용 먼저). 펼침 없음 */
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

function rowLabel(src: ChatSource): string {
  if (src.kind === "process_alert") {
    return src.title || src.doc_no;
  }
  if (src.kind === "quality_kpi") {
    return src.title || src.doc_no;
  }
  return `${src.doc_no} · ${src.title}`;
}

function rowHref(src: ChatSource): string {
  if (src.kind === "company_document" && src.file_url) return src.file_url;
  if (src.kind === "process_alert") return "/casting/process-optimization";
  if (src.kind === "quality_kpi") return "/casting/quality-inspection";
  return "";
}

function rowLinkText(src: ChatSource): string {
  if (src.kind === "company_document") return "원문";
  if (src.kind === "process_alert") return "관리도";
  if (src.kind === "quality_kpi") return "품질";
  return "열기";
}

/** 출처 = 한 줄(제목+링크). 스니펫·펼침 없음 */
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

  const [panelOpen, setPanelOpen] = useState(false);

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
          {ordered.map((src) => {
            const href = rowHref(src);
            return (
              <li key={`${src.kind}-${src.doc_no}-${src.chunk_no}-${src.file_name}`} className={s.srcRow}>
                <span className={s.srcRowLabel} title={rowLabel(src)}>
                  {rowLabel(src)}
                </span>
                {href ? (
                  <a
                    className={s.srcRowLink}
                    href={href}
                    target={src.kind === "company_document" ? "_blank" : undefined}
                    rel={src.kind === "company_document" ? "noreferrer" : undefined}
                  >
                    {rowLinkText(src)}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
