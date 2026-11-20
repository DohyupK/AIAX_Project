"use client";

import { useEffect, useState } from "react";
import { fetchAlPrices, type AlPriceRow } from "./api";
import s from "./AlPrice.module.css";

/** LME 알루미늄 시세 — org.aluminum_price 조회 표시 */
export default function AlPrice() {
  const [rows, setRows] = useState<AlPriceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchAlPrices(500)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e: unknown) => {
        console.error("[al_price] 조회 실패", e);
        if (alive) {
          setRows([]);
          setError(
            (e as Error).message ||
              "시세를 불러오지 못했습니다. aluminum_price serve·DB를 확인해 주세요.",
          );
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const latest = rows && rows.length > 0 ? rows[0] : null;

  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1 className={s.title}>알루미늄 가격</h1>
        <p className={s.sub}>
          LME 알루미늄(Al) 현물 시세 · 단위 US$/톤 · 출처 한국비철금속협회
        </p>
      </header>

      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}

      {rows === null && <p className={s.empty}>불러오는 중…</p>}

      {rows && rows.length === 0 && !error && (
        <p className={s.empty}>
          저장된 시세가 없습니다. 최초 CSV 백필 후 MS 적재, 또는 daily 크롤을 확인하세요.
        </p>
      )}

      {latest && (
        <div className={s.meta}>
          <span>
            최신 일자 <span className={s.metaStrong}>{latest.price_date}</span>
          </span>
          <span>
            Al{" "}
            <span className={s.metaStrong}>
              {latest.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>{" "}
            US$/톤
          </span>
          <span>표시 {rows!.length}건</span>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">일자 (price_date)</th>
                <th scope="col">Al 가격 (price)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.price_date}>
                  <td>{r.price_date}</td>
                  <td className={s.num}>
                    {r.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
