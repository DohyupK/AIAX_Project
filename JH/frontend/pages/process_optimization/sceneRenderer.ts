// 콜드챔버 다이캐스팅 설비 장면 (SVG 아이소메트릭 애니메이션) — React 밖에서 SVG 를 직접 그림
// 원본: 팀 제공 diecast_scene_only.html 의 장면 부분만 이식. 데이터·판정은 대시보드(샷 스트림·모델 정상 범위)에서 받음
// 설비 형상·색상은 원본 그대로, 바닥·그림자·라벨만 밝은 테마로 조정
import type { FeatureKey } from '../../common/casting/types';

export type SceneStatus = 'ok' | 'warn' | 'bad' | 'na';
export interface SceneShot { time: string; features: Partial<Record<FeatureKey, number | null>> }

/** 공정 단계 (한 사이클 약 15.6초). group: 0 형폐·주탕 / 1 사출 / 2 응고·냉각·취출 — 공정 변수 모니터 묶음과 같음 */
export const PHASES = [
  { k: 'close', n: '형폐', e: 'Die Close', d: 1.2, group: 0 },
  { k: 'ladle', n: '주탕', e: 'Ladling', d: 3.4, group: 0 },
  { k: 'slow', n: '저속 사출', e: '1st Stage · Slow Shot', d: 1.7, group: 1 },
  { k: 'fast', n: '고속 사출', e: '2nd Stage · Fast Shot', d: 0.5, group: 1 },
  { k: 'intens', n: '증압', e: 'Intensification', d: 0.8, group: 1 },
  { k: 'solid', n: '응고 · 냉각', e: 'Solidification', d: 2.6, group: 2 },
  { k: 'open', n: '형개', e: 'Die Open', d: 1.2, group: 2 },
  { k: 'eject', n: '취출', e: 'Ejection & Extraction', d: 2.4, group: 2 },
  { k: 'spray', n: '이형제 도포', e: 'Die Spray', d: 1.8, group: 2 },
] as const;

export interface SceneOptions {
  /** CSS Module 클래스 맵 (DiecastScene.module.css) */
  cls: Record<string, string>;
  /** 사이클 시작(형폐) 때마다 호출 — 가장 최근 샷 */
  getShot: () => SceneShot | null;
  statusOf: (k: FeatureKey, v: number | null) => SceneStatus;
  /** 정상 중앙값(p50) — 용탕량 비율 연출용 */
  mid: (k: FeatureKey) => number | null;
  label: (k: FeatureKey) => string;
  unit: (k: FeatureKey) => string;
  format: (v: number | null) => string;
  onPick: (k: FeatureKey) => void;
  onPhase: (i: number, shot: SceneShot | null) => void;
  /** 바구니 옆 「품질 검사」 버튼 — 품질 검사 페이지로 이동 */
  onQuality: () => void;
}

type V = number[];
type Pal = { t: string; x: string; y: string; s: string };
type CPal = { t: string; x: string; b: string; d: string; h: string; s: string };
type RodPal = { e: string; b: string; h: string };
type Attrs = Record<string, string | number>;

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const seg = (u: number, a: number, b: number) => clamp((u - a) / (b - a), 0, 1);
const mix = (c1: string, c2: string, t: number) => {
  const a = c1.match(/\w\w/g)!.map(h => parseInt(h, 16)), b = c2.match(/\w\w/g)!.map(h => parseInt(h, 16));
  return '#' + a.map((x, i) => Math.round(lerp(x, b[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
};
const V3 = {
  add: (a: V, b: V) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a: V, k: number) => [a[0] * k, a[1] * k, a[2] * k],
  lerp: (a: V, b: V, t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};
const bez = (a: V, m: V, b: V, t: number) => V3.lerp(V3.lerp(a, m, t), V3.lerp(m, b, t), t);

/* 아이소메트릭 투영 */
const S = 34, YAW = (27 * Math.PI) / 180, PK = 1.22;
const PAX = Math.cos(YAW) * PK, PAY = Math.sin(YAW) * PK, PBX = Math.sin(YAW) * 0.5 * PK, PBY = Math.cos(YAW) * 0.5 * PK;
const VW = 1200, OX = 267, OY = 330;
const P = (p: V): [number, number] => [VW - (OX + (p[0] * PAX - p[1] * PAY) * S), OY + (p[0] * PBX + p[1] * PBY) * S - p[2] * S];
const pstr = (arr: V[]) => arr.map(p => { const q = P(p); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');

/** 장면 라벨: 변수 → 박스 위치(viewBox 좌표) */
const LABEL_POS: [FeatureKey, number, number][] = [
  ['biscuit_thickness', 330, 100], ['molten_capacity', 150, 170],
  ['top_temp1', 480, 6], ['top_temp2', 660, 6], ['mechanical_strength', 840, 6],
  ['injection_pressure', 6, 390], ['cooling_water_temp', 1014, 560],
  ['sleeve_temperature', 210, 694], ['mold_temperature', 390, 694], ['bottom_temp1', 570, 694], ['bottom_temp2', 750, 694],
];
const STATUS_TEXT: Record<SceneStatus, string> = { ok: '정상', warn: '주의', bad: '이탈', na: '결측' };

export function createDiecastScene(svg: SVGSVGElement, o: SceneOptions) {
  const c = o.cls;
  const el = (tag: string, attrs: Attrs = {}, parent?: Element | null) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  };
  const G = (p: Element) => el('g', {}, p);
  const setLn = (ln: Element, p: number[], q: number[]) => {
    ln.setAttribute('x1', String(p[0])); ln.setAttribute('y1', String(p[1]));
    ln.setAttribute('x2', String(q[0])); ln.setAttribute('y2', String(q[1]));
  };
  const line3 = (parent: Element, a: V, b: V, attrs: Attrs) => { const p = P(a), q = P(b); return el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], ...attrs }, parent); };
  const poly3 = (parent: Element, pts: V[], attrs: Attrs) => el('polyline', { points: pstr(pts), fill: 'none', ...attrs }, parent);
  const setLine = (ln: Element, a: V, b: V) => setLn(ln, P(a), P(b));
  const circleAt = (e: Element, q: number[]) => { e.setAttribute('cx', String(q[0])); e.setAttribute('cy', String(q[1])); };

  const PAL: Record<string, Pal> = {
    frame: { t: '#47505a', x: '#373e46', y: '#2b3138', s: '#56606b' },
    dark: { t: '#3b4148', x: '#2f343a', y: '#252a2f', s: '#4b525a' },
    belt: { t: '#24292e', x: '#30363d', y: '#272c32', s: '#3d444c' },
    tcu: { t: '#3e4a54', x: '#323c45', y: '#283038', s: '#4c5965' },
    molten: { t: '#ff7a3c', x: '#f0481e', y: '#c4300f', s: '#ff9a5a' },
    white: { t: '#e3e7eb', x: '#c9cfd6', y: '#a9b1ba', s: '#eef1f4' },
    teal: { t: '#2c8f8d', x: '#22736f', y: '#1a5b58', s: '#3aa5a1' },
    die: { t: '#666c74', x: '#52575e', y: '#42464c', s: '#7a8088' },
  };
  const CHROME: RodPal = { e: '#4d565f', b: '#b9c1c9', h: '#f6f8fa' }, YEL: RodPal = { e: '#7d5c07', b: '#efb51c', h: '#ffe07a' }, BLK: RodPal = { e: '#0c0e10', b: '#262a2f', h: '#555c64' };
  const CHROME2: CPal = { t: '#d5dbe1', x: '#d5dbe1', b: '#aab2ba', d: '#7f8892', h: '#ffffff', s: '#59626c' };
  const CW: CPal = { t: '#e4e8ec', x: '#d2d8de', b: '#bcc4cc', d: '#8f98a2', h: '#f7f9fb', s: '#7f8892' };
  const CS: CPal = { t: '#6f7780', x: '#5d656e', b: '#4b525a', d: '#363b41', h: '#8d959e', s: '#30353a' };
  const CT: CPal = { t: '#2c8f8d', x: '#25807c', b: '#1f6c69', d: '#154e4c', h: '#48b3ae', s: '#124341' };
  const CY: CPal = { t: '#f4c233', x: '#e6b024', b: '#d49f18', d: '#a87c0e', h: '#ffe07a', s: '#7d5c07' };
  const CF: CPal = { t: '#565c63', x: '#7b838c', b: '#737b84', d: '#4f565e', h: '#a1a9b2', s: '#3b4147' };

  /* 프리미티브: 상자 · 봉 · 원통 · 호스 */
  function Box(parent: Element, pal: Pal | null, opts: { sw?: number; glass?: boolean } = {}) {
    const g = G(parent);
    const fy = el('polygon', {}, g), fx = el('polygon', {}, g), ft = el('polygon', {}, g);
    const b = {
      g,
      set(x: number, y: number, z: number, dx: number, dy: number, dz: number) {
        ft.setAttribute('points', pstr([[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]]));
        fx.setAttribute('points', pstr([[x + dx, y, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x + dx, y, z + dz]]));
        fy.setAttribute('points', pstr([[x, y + dy, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]]));
        return b;
      },
      color(p: Pal) {
        ft.setAttribute('fill', p.t); fx.setAttribute('fill', p.x); fy.setAttribute('fill', p.y);
        [ft, fx, fy].forEach(f => { f.setAttribute('stroke', p.s); f.setAttribute('stroke-width', String(opts.sw ?? 0.8)); f.setAttribute('stroke-linejoin', 'round'); });
        return b;
      },
      show(v: boolean) { (g as SVGElement).style.display = v ? '' : 'none'; return b; },
    };
    if (opts.glass) [ft, fx, fy].forEach(f => { f.setAttribute('fill', 'rgba(170,190,210,0.12)'); f.setAttribute('stroke', 'rgba(90,110,130,0.55)'); f.setAttribute('stroke-width', '1'); });
    else if (pal) b.color(pal);
    return b;
  }
  function Rod(parent: Element, w: number, col: RodPal) {
    const g = G(parent), mk = (cl: string, ww: number) => el('line', { stroke: cl, 'stroke-width': ww, 'stroke-linecap': 'round' }, g);
    const le = mk(col.e, w + 2.4), lb = mk(col.b, w), lh = mk(col.h, Math.max(1, w * 0.22));
    const r = {
      g,
      set(a: V, b: V) { return r.set2(P(a), P(b)); },
      set2(p: number[], q: number[]) {
        setLn(le, p, q); setLn(lb, p, q);
        const dx = q[0] - p[0], dy = q[1] - p[1], Ln = Math.hypot(dx, dy) || 1;
        let nx = dy / Ln, ny = -dx / Ln;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const k = w * 0.22;
        setLn(lh, [p[0] + nx * k, p[1] + ny * k], [q[0] + nx * k, q[1] + ny * k]);
        return r;
      },
    };
    return r;
  }
  function Cyl(parent: Element, axis: 'x' | 'z', pal: CPal) {
    const g = G(parent);
    const back = el('polygon', { fill: pal.b, stroke: pal.s, 'stroke-width': 0.8 }, g), body = el('polygon', { fill: pal.b }, g);
    const sh = el('line', { stroke: pal.d, opacity: 0.6 }, g), hl = el('line', { stroke: pal.h, opacity: 0.75 }, g);
    const e1 = el('line', { stroke: pal.s, 'stroke-width': 0.8 }, g), e2 = el('line', { stroke: pal.s, 'stroke-width': 0.8 }, g);
    const cap = el('polygon', { fill: axis === 'z' ? pal.t : pal.x, stroke: pal.s, 'stroke-width': 0.8 }, g);
    const N = 36, E = axis === 'x' ? [1, 0, 0] : [0, 0, 1], U = axis === 'x' ? [0, 1, 0] : [1, 0, 0], W3 = axis === 'x' ? [0, 0, 1] : [0, 1, 0];
    const aH = axis === 'x' ? 1.05 : 0.6, aS = axis === 'x' ? -0.3 : 1.8;
    const cy = {
      g, cap,
      set(ctr: V, len: number, r: number) {
        const pt = (t: number, off: number) => P([0, 1, 2].map(i => ctr[i] + E[i] * off + r * (Math.cos(t) * U[i] + Math.sin(t) * W3[i])));
        const r0: number[][] = [], r1: number[][] = [];
        for (let k = 0; k < N; k++) { const t = (k / N) * 2 * Math.PI; r0.push(pt(t, 0)); r1.push(pt(t, len)); }
        const ax = [r1[0][0] - r0[0][0], r1[0][1] - r0[0][1]];
        let iM = 0, im = 0, Mx = -1e9, mn = 1e9;
        r0.forEach((p, i) => { const d = p[0] * ax[1] - p[1] * ax[0]; if (d > Mx) { Mx = d; iM = i; } if (d < mn) { mn = d; im = i; } });
        const s = (a: number[][]) => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        back.setAttribute('points', s(r0)); body.setAttribute('points', s([r0[iM], r1[iM], r1[im], r0[im]])); cap.setAttribute('points', s(r1));
        setLn(e1, r0[iM], r1[iM]); setLn(e2, r0[im], r1[im]);
        const w = String(Math.max(1.5, r * S * 0.3)); hl.setAttribute('stroke-width', w); sh.setAttribute('stroke-width', w);
        setLn(hl, pt(aH, 0), pt(aH, len)); setLn(sh, pt(aS, 0), pt(aS, len));
        return cy;
      },
    };
    return cy;
  }
  const hose = (parent: Element, a: V, b: V, sag: number, w = 3.2) => {
    const p = P(a), q = P(b), d = `M${p[0]},${p[1]} Q${(p[0] + q[0]) / 2},${(p[1] + q[1]) / 2 + sag} ${q[0]},${q[1]}`;
    el('path', { d, fill: 'none', stroke: '#0e1012', 'stroke-width': w, 'stroke-linecap': 'round' }, parent);
    el('path', { d, fill: 'none', stroke: '#3d444b', 'stroke-width': w * 0.3, 'stroke-linecap': 'round', transform: 'translate(0,-0.8)' }, parent);
  };
  const ringXY = (ctr: V, r: number, N = 40) => { const a: V[] = []; for (let k = 0; k < N; k++) { const t = (k / N) * 2 * Math.PI; a.push([ctr[0] + r * Math.cos(t), ctr[1] + r * Math.sin(t), ctr[2]]); } return pstr(a); };
  const ringYZ = (x: number, cy: number, cz: number, r: number, N = 40, zmax = 1e9) => { const a: V[] = []; for (let k = 0; k < N; k++) { const t = (k / N) * 2 * Math.PI; a.push([x, cy + r * Math.cos(t), Math.min(cz + r * Math.sin(t), zmax)]); } return pstr(a); };
  const tag = (parent: Element, p: V, dy: number, txt: string) => { const q = P(p); el('text', { x: q[0], y: q[1] + dy, class: c.tag3d, 'text-anchor': 'middle' }, parent).textContent = txt; };

  /* ---------- 장면 구성 ---------- */
  svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  // 필터·그라디언트 id 는 문서 전역 → 접두어로 충돌 방지
  defs.innerHTML = `
 <filter id="dc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="dc-softGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>
 <filter id="dc-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
 <radialGradient id="dc-meltG" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#ffb070"/><stop offset=".45" stop-color="#ff431a"/><stop offset="1" stop-color="#a81a08"/></radialGradient>
 <radialGradient id="dc-domeG" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#f7f9fb"/><stop offset=".55" stop-color="#c3cad2"/><stop offset="1" stop-color="#98a1ab"/></radialGradient>`;
  const L: Record<string, Element> = {};
  ['floor', 'shadow', 'mach', 'door', 'tcu', 'belt', 'partBelt', 'robot', 'furnace', 'ladle', 'labels'].forEach(k => { L[k] = G(svg); });

  // 바닥 (밝은 테마)
  for (let x = -4; x <= 26; x += 2) line3(L.floor, [x, -3, 0], [x, 13, 0], { stroke: '#dbe1e8', 'stroke-width': 1 });
  for (let y = -3; y <= 13; y += 2) line3(L.floor, [-4, y, 0], [26, y, 0], { stroke: '#dbe1e8', 'stroke-width': 1 });
  const shadowAt = (x0: number, y0: number, x1: number, y1: number, op = 0.18) =>
    el('polygon', { points: pstr([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]), fill: '#1b2633', opacity: op, filter: 'url(#dc-shadow)' }, L.shadow);
  shadowAt(-2.2, -0.5, 22.6, 5.9); shadowAt(2.6, 7.4, 8.9, 10.5, 0.15); shadowAt(14.8, 7, 19, 11.2, 0.18); shadowAt(9.7, 6.3, 11.2, 7.8, 0.15); shadowAt(0.2, 6, 2.2, 7.7, 0.14);

  const M = L.mach;
  // 유압 유닛
  Box(M, PAL.teal).set(-1.9, 3.1, 0, 1.7, 1.9, 0.8);
  Cyl(M, 'x', CT).set([-1.8, 4.05, 1.3], 1.3, 0.5);
  // 베이스 프레임
  Box(M, PAL.teal).set(0, 0, 0, 22, 5, 1.2);
  for (let x = 1.4; x < 22; x += 2.06) line3(M, [x, 5, 0.14], [x, 5, 1.06], { stroke: '#124341', 'stroke-width': 1.2 });
  line3(M, [0.1, 5, 1.02], [21.9, 5, 1.02], { stroke: '#48b3ae', 'stroke-width': 1, opacity: 0.55 });
  line3(M, [0.1, 5, 0.16], [21.9, 5, 0.16], { stroke: '#124341', 'stroke-width': 2 });
  for (let i = 0; i < 10; i++) {
    const x = 1.4 + i * 2.06;
    if (i % 2 === 0) [0.4, 0.52, 0.64, 0.76].forEach(z => line3(M, [x + 0.45, 5, z], [x + 1.6, 5, z], { stroke: '#124341', 'stroke-width': 1.3 }));
    else {
      el('polygon', { points: pstr([[x + 0.35, 5, 0.32], [x + 1.7, 5, 0.32], [x + 1.7, 5, 0.9], [x + 0.35, 5, 0.9]]), fill: 'none', stroke: '#3aa5a1', 'stroke-width': 0.8, opacity: 0.7 }, M);
      line3(M, [x + 1.45, 5, 0.52], [x + 1.45, 5, 0.7], { stroke: '#c9d0d7', 'stroke-width': 2, 'stroke-linecap': 'round' });
    }
    [[x + 0.12, 0.26], [x + 0.12, 0.96], [x + 1.94, 0.26], [x + 1.94, 0.96]].forEach(([bx, bz]) => { const q = P([bx, 5, bz]); el('circle', { cx: q[0], cy: q[1], r: 1.2, fill: '#124341' }, M); });
  }
  [0.3, 5.4, 10.8, 16.2, 21.2].forEach(x => Box(M, PAL.dark).set(x, 4.7, -0.02, 0.5, 0.45, 0.14));
  line3(M, [2.2, 4.82, 1.24], [11.5, 4.82, 1.24], { stroke: '#59626c', 'stroke-width': 5, 'stroke-linecap': 'round' });
  line3(M, [2.2, 4.82, 1.27], [11.5, 4.82, 1.27], { stroke: '#d5dbe1', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
  // 뒤쪽 타이바
  [2.2, 6.6].forEach(z => Rod(M, 8, CHROME).set([2.2, 0.6, z], [11.5, 0.6, z]));
  // 형체 실린더
  Cyl(M, 'x', CS).set([-2.25, 2.5, 4.35], 0.4, 0.5);
  Cyl(M, 'x', CW).set([-1.9, 2.5, 4.35], 2.9, 1.05);
  hose(M, [-1.2, 3.0, 5.3], [1.5, 4.2, 7.5], -14); hose(M, [-0.6, 3.3, 5.1], [0.4, 5, 1.2], 26); hose(M, [-1.4, 3.4, 4.6], [-1.0, 4.6, 0.8], 22);
  // 리어 플래튼
  Box(M, PAL.white).set(1, 0, 1.2, 1.2, 5, 6.3);
  // 앞쪽 타이바 + 토글 링크
  const tieFa = [0, 1].map(() => Rod(M, 8, CHROME));
  const tgO = [0, 1, 2].map(() => el('polyline', { fill: 'none', stroke: '#7f8892', 'stroke-width': 13, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, M));
  const tgB = [0, 1, 2].map(() => el('polyline', { fill: 'none', stroke: '#d5dbe1', 'stroke-width': 10, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, M));
  const xhead = Box(M, PAL.white);
  const tgPins = Array.from({ length: 6 }, () => el('circle', { r: 4.2, fill: '#4b525a', stroke: '#9aa3ad', 'stroke-width': 1 }, M));
  const movPlaten = Box(M, PAL.white);
  const shoe = Box(M, PAL.dark);
  const movDie = Box(M, PAL.die);
  function dieDetail(parent: Element, x0: number, x1: number, xc: number) {
    const g = G(parent), Y = 4.32;
    [[x0 + 0.13, 2.0], [x0 + 0.13, 6.8], [x1 - 0.13, 6.8], [x1 - 0.13, 2.0]].forEach(([x, z]) => { const q = P([x, Y, z]); el('circle', { cx: q[0], cy: q[1], r: 2.6, fill: '#2b2f34', stroke: '#9097a0', 'stroke-width': 0.8 }, g); });
    el('polygon', { points: pstr([[x0 + 0.28, Y, 6.15], [x1 - 0.28, Y, 6.15], [x1 - 0.28, Y, 6.62], [x0 + 0.28, Y, 6.62]]), fill: '#3a3e44', stroke: '#858c95', 'stroke-width': 0.7 }, g);
    line3(g, [x0, Y, 5.9], [x1, Y, 5.9], { stroke: '#33373c', 'stroke-width': 1 }); line3(g, [x0, Y, 2.7], [x1, Y, 2.7], { stroke: '#33373c', 'stroke-width': 1 });
    const p = P([xc, Y, 3.4]), b = P([xc + 0.05, 5, 1.2]);
    el('path', { d: `M${p[0]},${p[1]} Q${p[0]},${(p[1] + b[1]) / 2 + 14} ${b[0]},${b[1]}`, fill: 'none', stroke: '#1f4558', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: p[0], cy: p[1], r: 3.4, fill: '#4cc3ff', stroke: '#12303c', 'stroke-width': 1.2 }, g);
    const t = P([xc, Y, 2.4]); el('rect', { x: t[0] - 3.5, y: t[1] - 3.5, width: 7, height: 7, rx: 1.5, fill: '#22262a', stroke: '#c9d0d7', 'stroke-width': 1 }, g);
    return g;
  }
  const movDet = dieDetail(M, 8.5, 10, 9.0);
  const tcM = Box(M, PAL.dark);
  const CAV = { y: 2.5, z: 4.3, R: 1.15 };
  const dieFace = G(M);
  {
    const X = 10.01, g = dieFace, pg = (pts: string, at: Attrs) => el('polygon', { points: pts, 'stroke-linejoin': 'round', ...at }, g);
    pg(pstr([[X, 0.95, 2.05], [X, 4.05, 2.05], [X, 4.05, 6.75], [X, 0.95, 6.75]]), { fill: 'none', stroke: '#7a8088', 'stroke-width': 0.9 });
    pg(pstr([[X, 2.36, 2.0], [X, 2.64, 2.0], [X, 2.64, 3.25], [X, 2.36, 3.25]]), { fill: '#26292d', stroke: '#8a9199', 'stroke-width': 0.8 });
    pg(ringYZ(X, 2.5, 2.25, 0.42, 24), { fill: '#26292d', stroke: '#8a9199', 'stroke-width': 0.8 });
    pg(ringYZ(X, CAV.y, CAV.z, CAV.R * 1.03), { fill: '#2c3035', stroke: '#aeb6be', 'stroke-width': 1.1 });
    pg(ringYZ(X, CAV.y, CAV.z, CAV.R * 0.8), { fill: 'none', stroke: '#5d646c', 'stroke-width': 1.4 });
    pg(ringYZ(X, CAV.y, CAV.z, CAV.R * 0.64), { fill: '#191b1e', stroke: '#4a5057', 'stroke-width': 1 });
    for (let j = 0; j < 7; j++) {
      const a: V[] = [];
      for (let q = 0; q <= 6; q++) { const rr = CAV.R * (0.33 + (0.29 * q) / 6), t = (j / 7) * Math.PI * 2 + (q / 6) * 0.95; a.push([X, CAV.y + rr * Math.cos(t), CAV.z + rr * Math.sin(t)]); }
      poly3(g, a, { stroke: '#6a727b', 'stroke-width': 1.5, 'stroke-linecap': 'round' });
    }
    pg(ringYZ(X, CAV.y, CAV.z, CAV.R * 0.31, 24), { fill: '#3d4248', stroke: '#8a9199', 'stroke-width': 0.8 });
    pg(ringYZ(X, CAV.y, CAV.z, CAV.R * 0.17, 20), { fill: '#9aa3ad', stroke: '#2b2f34', 'stroke-width': 0.8 });
    [[1.25, 2.35], [3.75, 2.35], [1.25, 6.45], [3.75, 6.45]].forEach(([y, z]) => { pg(ringYZ(X, y, z, 0.2, 16), { fill: '#c3cad2', stroke: '#59626c', 'stroke-width': 0.8 }); });
    [[1.15, 4.3], [3.85, 4.3], [2.5, 5.75]].forEach(([y, z]) => pg(ringYZ(X, y, z, 0.16, 12), { fill: '#1b1d20', stroke: '#6a727b', 'stroke-width': 0.7 }));
  }
  const partDie = G(M);
  Box(M, PAL.die).set(10, 0.7, 1.8, 1.5, 3.6, 5.2); // 고정 금형
  const cavF = el('polygon', { fill: '#f4431c', opacity: 0 }, M);
  const cavGlow = el('polygon', { fill: '#f4431c', opacity: 0, filter: 'url(#dc-softGlow)' }, M);
  const runner = el('polygon', { fill: '#f4431c', opacity: 0 }, M);
  const cavRing = el('polygon', { fill: 'rgba(20,22,25,.55)', stroke: '#c9d0d7', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0 }, M);
  M.insertBefore(cavRing, cavF);
  dieDetail(M, 10, 10.82, 10.5);
  Box(M, PAL.dark).set(10.63, 3.28, 7.0, 0.24, 0.24, 0.16);
  const tieFb = [0, 1].map(() => Rod(M, 8, CHROME));
  // 고정 플래튼 + 타이바 너트
  Box(M, PAL.white).set(11.5, 0, 1.2, 1, 5, 6.3);
  [3.6, 4.9, 6.0].forEach(z => line3(M, [12.5, 1.2, z], [12.5, 3.8, z], { stroke: '#8d96a0', 'stroke-width': 2.2 }));
  [1.3, 3.7].forEach(y => line3(M, [12.5, y, 3.6], [12.5, y, 6.9], { stroke: '#9aa3ad', 'stroke-width': 1 }));
  el('polygon', { points: pstr([[12.5, 1.9, 6.35], [12.5, 3.1, 6.35], [12.5, 3.1, 6.8], [12.5, 1.9, 6.8]]), fill: '#30353a', stroke: '#c9d0d7', 'stroke-width': 0.7 }, M);
  [[0.6, 2.2], [0.6, 6.6], [4.4, 2.2], [4.4, 6.6]].forEach(([y, z]) => { Cyl(M, 'x', CS).set([12.5, y, z], 0.38, 0.42); Cyl(M, 'x', CHROME2).set([12.88, y, z], 0.22, 0.2); });
  // 경광등 (최근 샷 상태)
  Cyl(M, 'z', CS).set([12, 0.6, 7.5], 0.45, 0.07);
  const TWR = ([['#3fb68b', 'ok'], ['#e8a33d', 'warn'], ['#ef4d4d', 'bad']] as const).map(([cl, lv], j) =>
    ({ lv, g: Cyl(M, 'z', { t: cl, x: cl, b: cl, d: cl, h: '#ffffff', s: '#15181b' }).set([12, 0.6, 7.95 + j * 0.3], 0.28, 0.17).g as SVGElement }));
  const setTower = (lv: 'ok' | 'warn' | 'bad') => TWR.forEach(t => { const on = t.lv === lv; t.g.style.opacity = on ? '1' : '0.25'; t.g.setAttribute('filter', on ? 'url(#dc-glow)' : ''); });
  // 어큐뮬레이터 (N₂)
  const BR = 0.58, BYY = 0.8, BXS = [18.25, 19.55, 20.85];
  Box(M, PAL.dark).set(17.75, 0.3, 1.2, 3.6, 1.05, 0.3);
  BXS.forEach(x => {
    const rx = BR * S * PK, lo = P([x, BYY, 2.0]), hi = P([x, BYY, 6.0]);
    Cyl(M, 'z', CS).set([x, BYY, 1.5], 0.3, 0.2);
    el('ellipse', { cx: lo[0], cy: lo[1], rx, ry: BR * S * 0.85, fill: '#a9b1ba', stroke: CW.s, 'stroke-width': 0.8 }, M);
    const body = Cyl(M, 'z', CW).set([x, BYY, 2.0], 4.0, BR); body.cap.setAttribute('fill', CW.b); body.cap.setAttribute('stroke', 'none');
    el('ellipse', { cx: hi[0], cy: hi[1], rx, ry: BR * S * 0.95, fill: 'url(#dc-domeG)', stroke: CW.s, 'stroke-width': 0.8 }, M);
    [2.9, 5.1].forEach(z => {
      const a: V[] = [];
      for (let k = -9; k <= 27; k++) { const t = (k / 72) * 2 * Math.PI; a.push([x + (BR + 0.01) * Math.cos(t), BYY + (BR + 0.01) * Math.sin(t), z]); }
      poly3(M, a, { stroke: '#6f7882', 'stroke-width': 4.5 }); poly3(M, a, { stroke: '#aeb6be', 'stroke-width': 1.2 });
    });
    Cyl(M, 'z', CS).set([x, BYY, 6.5], 0.22, 0.15); Cyl(M, 'z', CS).set([x, BYY, 6.72], 0.14, 0.24); Cyl(M, 'z', CHROME2).set([x, BYY, 6.86], 0.1, 0.1);
  });
  [2.9, 5.1].forEach(z => {
    line3(M, [BXS[0], BYY + BR + 0.04, z], [BXS[2], BYY + BR + 0.04, z], { stroke: '#59626c', 'stroke-width': 6 });
    line3(M, [BXS[0], BYY + BR + 0.04, z + 0.03], [BXS[2], BYY + BR + 0.04, z + 0.03], { stroke: '#c3cad2', 'stroke-width': 2 });
  });
  tag(M, [BXS[2], BYY, 7.3], -6, 'N₂ ACC');
  // 슬리브 · 플런저 (컷어웨이)
  const metal = Box(M, PAL.molten, { sw: 0.5 });
  [cavRing, cavGlow, cavF, runner].forEach(e => M.insertBefore(e, metal.g));
  metal.g.setAttribute('filter', 'url(#dc-glow)');
  const tip = Box(M, { t: '#a3abb4', x: '#8a929b', y: '#737a83', s: '#b8c0c8' });
  const rod = Box(M, { t: '#c9d0d7', x: '#aab2ba', y: '#8d959e', s: '#e1e6ea' });
  Box(M, null, { glass: true }).set(12.5, 1.9, 2.0, 4.6, 1.2, 1.2);
  { const q = P([15.85, 2.5, 3.2]); el('ellipse', { cx: q[0], cy: q[1], rx: 9, ry: 5, fill: '#0c0e10', stroke: '#9aa3ad', 'stroke-width': 1 }, M); }
  // 사출 실린더
  Box(M, PAL.teal).set(17.5, 1.6, 1.2, 3.7, 1.8, 0.5);
  Cyl(M, 'x', CW).set([17.3, 2.5, 2.6], 0.35, 1.25);
  Cyl(M, 'x', CW).set([17.65, 2.5, 2.6], 3.0, 1.0);
  [1.75, 0.8, -0.15].forEach(t => Rod(M, 2.6, CHROME).set([17.6, 2.5 + 1.07 * Math.cos(t), 2.6 + 1.07 * Math.sin(t)], [20.7, 2.5 + 1.07 * Math.cos(t), 2.6 + 1.07 * Math.sin(t)]));
  Cyl(M, 'x', CW).set([20.65, 2.5, 2.6], 0.4, 1.16);
  Cyl(M, 'x', CS).set([21.05, 2.5, 2.6], 0.25, 0.45);
  [0.4, 1.35, 2.3, 3.25, 4.2, 5.15].forEach(t => { const q = P([21.06, 2.5 + 0.9 * Math.cos(t), 2.6 + 0.9 * Math.sin(t)]); el('circle', { cx: q[0], cy: q[1], r: 2.4, fill: '#4b525a', stroke: '#8d959e', 'stroke-width': 0.7 }, M); });
  Box(M, PAL.white).set(18.5, 2.0, 3.5, 1.9, 1.0, 0.65);
  {
    const a: V[] = [];
    for (let k = 0; k < 24; k++) { const t = (k / 24) * 2 * Math.PI; a.push([19.25 + 0.22 * Math.cos(t), 3.01, 3.86 + 0.22 * Math.sin(t)]); }
    el('polygon', { points: pstr(a), fill: '#f4f6f8', stroke: '#2b2f34', 'stroke-width': 1.6 }, M);
    line3(M, [19.25, 3.02, 3.86], [19.36, 3.02, 3.99], { stroke: '#d23b2e', 'stroke-width': 1.3 });
    [18.7, 19.75, 20.1].forEach(x => { const q = P([x, 3.01, 3.8]); el('circle', { cx: q[0], cy: q[1], r: 2.6, fill: '#2b2f34', stroke: '#9097a0', 'stroke-width': 0.8 }, M); });
  }
  BXS.forEach(x => poly3(M, [[x, BYY + BR, 2.3], [x, 1.75, 2.3], [x, 1.75, 3.8], [x, 2.0, 3.8]], { stroke: '#3b4148', 'stroke-width': 3.5, 'stroke-linejoin': 'round' }));
  const accPipe: V[] = [[19.55, BYY + BR, 4.6], [19.55, 2.5, 4.6], [19.55, 2.5, 4.15]];
  poly3(M, accPipe, { stroke: '#3b4148', 'stroke-width': 5, 'stroke-linejoin': 'round' });
  const hydFlow = poly3(M, accPipe, { stroke: '#ffb454', 'stroke-width': 2, class: c.flow, opacity: 0 });
  hose(M, [18.2, 3.2, 3.3], [17.6, 5, 1.1], 22); hose(M, [20.3, 3.3, 3.2], [20.9, 5, 1.1], 20);
  // 스프레이 장치
  Cyl(M, 'z', CS).set([12, 2.5, 7.5], 0.25, 0.5);
  Cyl(M, 'z', CY).set([12, 2.5, 7.75], 1.7, 0.34);
  Rod(M, 11, YEL).set([12, 2.5, 9.5], [8.5, 2.5, 9.5]);
  [[12, 2.5, 9.5], [8.5, 2.5, 9.5]].forEach(p => { const q = P(p); el('circle', { cx: q[0], cy: q[1], r: 8, fill: '#2a2e33', stroke: '#ffd95e', 'stroke-width': 2 }, M); });
  const sprRod = Rod(M, 4, CHROME);
  const sprN0 = Cyl(M, 'x', CW), sprBody = Cyl(M, 'z', CS), sprN1 = Cyl(M, 'x', CW);
  const mistG = G(M);

  // 안전 도어
  const DY = 5.15;
  line3(L.door, [0.2, DY, 7.85], [11.5, DY, 7.85], { stroke: '#30353a', 'stroke-width': 4, 'stroke-linecap': 'round' });
  const doorG = G(L.door);
  const doorGlass = el('polygon', { fill: 'rgba(190,215,235,.12)', stroke: '#e0b020', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, doorG);
  const doorMid = el('line', { stroke: '#e0b020', 'stroke-width': 1.6, opacity: 0.8 }, doorG);
  const doorHz0 = el('line', { stroke: '#1a1c1f', 'stroke-width': 6 }, doorG), doorHz = el('line', { stroke: '#e8b820', 'stroke-width': 6, 'stroke-dasharray': '7 7' }, doorG);
  const doorWarn = el('polygon', { fill: '#f4c233', stroke: '#1a1c1f', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, doorG);
  const doorHandle = el('line', { stroke: '#cfd5db', 'stroke-width': 3, 'stroke-linecap': 'round' }, doorG);
  function setDoor(x0: number) {
    const x1 = x0 + 6.3;
    doorGlass.setAttribute('points', pstr([[x0, DY, 1.35], [x1, DY, 1.35], [x1, DY, 7.7], [x0, DY, 7.7]]));
    setLine(doorMid, [x0, DY, 4.6], [x1, DY, 4.6]); setLine(doorHz0, [x0, DY, 1.5], [x1, DY, 1.5]); setLine(doorHz, [x0, DY, 1.5], [x1, DY, 1.5]);
    setLine(doorHandle, [x1 - 0.35, DY, 3.9], [x1 - 0.35, DY, 4.5]);
    doorWarn.setAttribute('points', pstr([[x0 + 0.45, DY, 5.2], [x0 + 1.15, DY, 5.2], [x0 + 0.8, DY, 5.85]]));
  }

  // 금형 온도조절기(TCU) · 냉각수 라인
  Box(L.tcu, PAL.tcu).set(0.4, 6.2, 0, 1.6, 1.3, 1.8);
  tag(L.tcu, [1.2, 7.5, 0], 14, 'TCU');
  const coolPts: V[] = [[1.2, 6.2, 1.5], [1.2, 5.6, 1.5], [10.7, 5.6, 1.5], [10.7, 4.45, 2.0], [10.7, 4.45, 3.4]];
  poly3(L.tcu, coolPts, { stroke: '#1f4558', 'stroke-width': 4, 'stroke-linejoin': 'round' });
  poly3(L.tcu, coolPts, { stroke: '#4cc3ff', 'stroke-width': 2, class: c.flow, 'stroke-linejoin': 'round', opacity: 0.8 });

  // 컨베이어
  const BX0 = 2.8, BX1 = 8.6, BY0 = 7.6, BDY = 2.6, BYC = BY0 + BDY / 2, GX = 3.9;
  {
    const gp = { t: '#1f5c33', x: '#2f7d46', y: '#256638', s: '#49a565' };
    Box(L.belt, gp).set(1.25, 8.2, 0, 1.3, 1.4, 1.0);
    el('polygon', { points: pstr([[1.33, 8.28, 1.0], [2.47, 8.28, 1.0], [2.47, 9.52, 1.0], [1.33, 9.52, 1.0]]), fill: '#143d22', stroke: '#49a565', 'stroke-width': 0.6 }, L.belt);
    [0.33, 0.66].forEach(z => { line3(L.belt, [1.25, 9.6, z], [2.55, 9.6, z], { stroke: '#1a4a29', 'stroke-width': 1 }); line3(L.belt, [2.55, 8.2, z], [2.55, 9.6, z], { stroke: '#1f5c33', 'stroke-width': 1 }); });
  }
  [[BX0 + 0.2, BY0 + BDY - 0.3], [BX1 - 0.5, BY0 + BDY - 0.3], [BX1 - 0.5, BY0]].forEach(([x, y]) => Box(L.belt, PAL.frame).set(x, y, 0, 0.3, 0.3, 0.6));
  Box(L.belt, PAL.belt).set(BX0, BY0, 0.6, BX1 - BX0, BDY, 0.3);
  const beltStripes = el('polyline', { points: pstr([[BX0, BYC, 0.9], [BX1, BYC, 0.9]]), stroke: '#343b42', 'stroke-width': 40, 'stroke-dasharray': '2 12', fill: 'none' }, L.belt);
  [BY0 + 0.06, BY0 + BDY - 0.06].forEach(y => line3(L.belt, [BX0, y, 0.93], [BX1, y, 0.93], { stroke: '#8d959e', 'stroke-width': 2.5 }));
  Box(L.belt, PAL.frame).set(GX, BY0 - 0.3, 0, 0.3, 0.3, 2.9);

  // 제품 (임펠러)
  function Impeller(parent: Element) {
    const g = el('g', {}, parent) as SVGElement;
    const mk = (attrs: Attrs) => el('polygon', { ...attrs, 'stroke-linejoin': 'round' }, g);
    const back = mk({ fill: '#5d646c', stroke: '#4a5057', 'stroke-width': 1 });
    const front = mk({ stroke: '#e2e7ec', 'stroke-width': 0.8 });
    const groove = mk({ fill: 'none', stroke: '#4b5158', 'stroke-width': 1.6 });
    const recess = mk({ fill: '#24282d', stroke: '#3c4248', 'stroke-width': 1 });
    const vanes = Array.from({ length: 7 }, () => el('polyline', { fill: 'none', stroke: '#59616a', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g));
    const hub = mk({ stroke: '#e2e7ec', 'stroke-width': 0.8 });
    const bore = mk({ fill: '#0f1113', stroke: '#7a828b', 'stroke-width': 0.8 });
    return {
      show(v: boolean) { g.style.display = v ? '' : 'none'; },
      // ctr: 중심, a: 0=세움(법선 +x) → π/2=눕힘(법선 +z), R: 반지름, hot: 0~1 (달궈진 정도)
      set(ctr: V, a: number, R: number, hot: number) {
        const n = [Math.cos(a), 0, Math.sin(a)], u = [0, 1, 0], v = [-Math.sin(a), 0, Math.cos(a)], th = 0.32;
        const at = (r: number, t: number, off: number) => [0, 1, 2].map(i => ctr[i] + n[i] * off + r * (Math.cos(t) * u[i] + Math.sin(t) * v[i]));
        const ring = (r: number, off: number, N = 44) => { const pts: V[] = []; for (let k = 0; k < N; k++) pts.push(at(r, (k / N) * Math.PI * 2, off)); return pstr(pts); };
        back.setAttribute('points', ring(R, 0)); front.setAttribute('points', ring(R, th));
        groove.setAttribute('points', ring(R * 0.8, th)); recess.setAttribute('points', ring(R * 0.64, th + 0.01));
        hub.setAttribute('points', ring(R * 0.31, th + 0.08, 28)); bore.setAttribute('points', ring(R * 0.17, th + 0.09, 24));
        vanes.forEach((vn, j) => {
          const pts: V[] = [];
          for (let s = 0; s <= 6; s++) pts.push(at(R * (0.33 + (0.29 * s) / 6), (j / 7) * Math.PI * 2 + (s / 6) * 0.95, th + 0.02));
          vn.setAttribute('points', pstr(pts));
        });
        front.setAttribute('fill', mix('c6ccd2', 'e8925a', hot));
        hub.setAttribute('fill', mix('b3bac2', 'e08550', hot));
        back.setAttribute('fill', mix('5d646c', 'a3502a', hot));
      },
    };
  }
  const impDie = Impeller(partDie); impDie.show(false);
  const impBelt = Impeller(L.partBelt); impBelt.show(false);
  Box(L.partBelt, PAL.frame).set(GX, BY0 + BDY, 0, 0.3, 0.3, 2.9);
  Box(L.partBelt, PAL.frame).set(GX, BY0 - 0.3, 2.9, 0.3, BDY + 0.6, 0.3);

  // 취출 로봇
  const RS = [10.4, 7.0, 2.15], RL1 = 3.5, RL2 = 3.4;
  Box(L.robot, PAL.dark).set(9.85, 6.45, 0, 1.1, 1.1, 1.1);
  Cyl(L.robot, 'z', CY).set([10.4, 7.0, 1.1], 0.75, 0.5);
  const impGrip = Impeller(L.robot); impGrip.show(false);
  const rb = { u: Rod(L.robot, 14, YEL), f: Rod(L.robot, 10.5, YEL), w: Rod(L.robot, 5, BLK) };
  const rbG = [0, 1, 2].map(() => Rod(L.robot, 3.2, BLK));
  const rbJ = [11, 9, 6].map(r => el('circle', { r, fill: '#2a2e33', stroke: '#ffd95e', 'stroke-width': 2 }, L.robot));
  tag(L.robot, [10.95, 7.55, 0], 16, 'ROBOT');

  // 조작반 · 보온로 · 급탕기
  Box(L.furnace, PAL.white).set(13.6, 5.9, 0, 1, 1, 4.8); Box(L.furnace, PAL.dark).set(13.5, 5.8, 0, 1.2, 1.2, 0.25);
  Box(L.furnace, PAL.dark).set(11.55, 10.25, 0, 0.16, 0.16, 2.4);
  Box(L.furnace, PAL.white).set(11.15, 10.2, 2.4, 0.95, 0.25, 0.9);
  el('polygon', { points: pstr([[11.23, 10.46, 2.5], [12.02, 10.46, 2.5], [12.02, 10.46, 3.2], [11.23, 10.46, 3.2]]), fill: '#0f3443', stroke: '#4cc3ff', 'stroke-width': 0.8 }, L.furnace);
  [2.68, 2.86, 3.04].forEach((z, i) => line3(L.furnace, [11.3, 10.47, z], [11.3 + 0.35 + i * 0.12, 10.47, z], { stroke: '#4cc3ff', 'stroke-width': 1.4, opacity: 0.8 }));
  const FC = [16.8, 9.0];
  Cyl(L.furnace, 'z', CF).set([FC[0], FC[1], 0], 2.7, 1.75);
  [0.5, 2.2].forEach(z => {
    const a: V[] = [];
    for (let k = -9; k <= 27; k++) { const t = (k / 72) * 2 * Math.PI; a.push([FC[0] + 1.76 * Math.cos(t), FC[1] + 1.76 * Math.sin(t), z]); }
    poly3(L.furnace, a, { stroke: '#3b4147', 'stroke-width': 3 });
  });
  el('polygon', { points: ringXY([FC[0], FC[1], 2.71], 1.4), fill: '#ff3212', filter: 'url(#dc-softGlow)', opacity: 0.6, class: c.flicker }, L.furnace);
  el('polygon', { points: ringXY([FC[0], FC[1], 2.71], 1.4), fill: 'url(#dc-meltG)', stroke: '#2a2e33', 'stroke-width': 2, class: c.flicker }, L.furnace);
  tag(L.furnace, [20.4, 9.2, 0], 10, 'HOLDING FURNACE');
  Box(L.furnace, PAL.dark).set(18.45, 8.5, 0.5, 0.6, 1.0, 1.1); Cyl(L.furnace, 'x', CS).set([19.05, 9.0, 1.05], 0.5, 0.18);
  Rod(L.furnace, 3, CHROME).set([17.6, 8.5, 2.72], [18.6, 8.0, 4.1]); Box(L.furnace, PAL.dark).set(18.45, 7.85, 4.1, 0.3, 0.3, 0.25);
  hose(L.furnace, [18.6, 8.0, 4.2], [19.4, 7.5, 0], 18, 2.2);
  const ldArm = [Rod(L.ladle, 9, YEL), Rod(L.ladle, 7, YEL)];
  const joints = [7, 5.5].map(r => el('circle', { r, fill: '#2a2e33', stroke: '#ffd95e', 'stroke-width': 1.6 }, L.ladle));
  const ladle = Cyl(L.ladle, 'z', CS);
  const ladleMelt = el('polygon', { fill: 'url(#dc-meltG)' }, L.ladle);
  const stream = el('polyline', { fill: 'none', stroke: '#ff5526', 'stroke-width': 4, 'stroke-linecap': 'round', filter: 'url(#dc-glow)', opacity: 0 }, L.ladle);

  /* ---------- 센서 라벨 — 누르면 onPick(변수) ---------- */
  /* ---------- 품질 검사 이동 버튼: 완성품 바구니(오른쪽 아래) 옆 빈 공간 ---------- */
  {
    const bx = 1082, by = 476, bw = 110, bh = 44;
    const btn = el('g', { transform: `translate(${bx},${by})`, class: c.qcBtn, tabindex: 0, role: 'link', 'aria-label': '품질 검사 대시보드로 이동' }, L.labels);
    el('rect', { class: c.qcBox, width: bw, height: bh, rx: 8 }, btn);
    el('text', { class: c.qcText, x: bw / 2, y: bh / 2 + 6, 'text-anchor': 'middle' }, btn).textContent = '품질 검사 →';
    btn.addEventListener('click', () => o.onQuality());
    btn.addEventListener('keydown', e => { const k = (e as KeyboardEvent).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); o.onQuality(); } });
  }

  const W = 172, Hh = 70; // 장면이 패널 폭에 맞춰 축소되므로 viewBox 단위로 크게
  const labels = LABEL_POS.map(([id, bx, by]) => {
    const g = el('g', { class: c.lbl }, L.labels);
    const lead = el('polyline', { class: c.lead }, g);
    const ring = el('circle', { class: c.ring, r: 3 }, g), anc = el('circle', { class: c.anc, r: 3 }, g);
    const b = el('g', { transform: `translate(${bx},${by})`, class: c.hit, tabindex: 0, role: 'button', 'aria-label': `${o.label(id)} — 공정 변수 모니터로 이동` }, g);
    el('rect', { class: c.box, width: W, height: Hh, rx: 6 }, b);
    el('rect', { class: c.stat, x: 0, y: 10, width: 5, height: Hh - 20, rx: 2.5 }, b);
    el('text', { class: c.nm, x: 14, y: 24 }, b).textContent = o.label(id);
    const val = el('text', { class: c.val, x: 14, y: 56 }, b);
    const unit = el('tspan', { class: c.un, dx: 4 });
    const sb = el('text', { class: c.sb, x: W - 10, y: 24, 'text-anchor': 'end' }, b);
    const pick = () => o.onPick(id);
    b.addEventListener('click', pick);
    b.addEventListener('keydown', e => { const k = (e as KeyboardEvent).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(); } });
    return { id, bx, by, g, lead, ring, anc, val, unit, sb, shown: NaN };
  });
  function anchorOf(id: FeatureKey, face: number): V {
    switch (id) {
      case 'mechanical_strength': return [1.6, 2.5, 7.5];
      case 'top_temp2': return [face - 0.75, 2.5, 7.15];
      case 'top_temp1': return [10.75, 3.4, 7.15];
      case 'bottom_temp2': return [face - 1.0, 4.32, 2.4];
      case 'bottom_temp1': return [10.5, 4.32, 2.4];
      case 'biscuit_thickness': return [12.75, 2.5, 3.2];
      case 'molten_capacity': return [15.85, 2.5, 3.2];
      case 'injection_pressure': return [19.25, 3.01, 3.86];
      case 'sleeve_temperature': return [14.4, 3.1, 2.6];
      case 'mold_temperature': return [17.6, 8.5, 2.72];
      default: return [1.2, 5.9, 1.5]; // cooling_water_temp
    }
  }

  /* ---------- 상태 ---------- */
  let cur: SceneShot | null = null, prev: SceneShot | null = null;
  let phase = 0, pt = 0, paused = false, raf = 0, lastT = performance.now();
  let part: { on?: boolean; belt?: boolean; x?: number } = {};
  let mist: { x: number; y: number; z: number; vx: number; vz: number; life: number }[] = [];
  const valOf = (s: SceneShot | null, k: FeatureKey) => s?.features[k] ?? null;

  /** 경광등: 장면 변수 중 이탈 있으면 적색, 주의면 황색 */
  function towerLevel(): 'ok' | 'warn' | 'bad' {
    if (!cur) return 'ok';
    const st = LABEL_POS.map(([k]) => o.statusOf(k, valOf(cur, k)));
    return st.includes('bad') ? 'bad' : st.includes('warn') ? 'warn' : 'ok';
  }

  /* ---------- 운동학 ---------- */
  function kin(i: number, u: number) {
    const k = PHASES[i].k;
    let mx = 4.5, px = 17, Vol = 0, fill = 0, metalOn = false;
    if (k === 'close') mx = lerp(4.5, 7.5, ease(u));
    else if (['ladle', 'slow', 'fast', 'intens', 'solid'].includes(k)) mx = 7.5;
    else if (k === 'open') mx = lerp(7.5, 4.5, ease(u));
    if (k === 'slow') px = 17 - 2.8 * Math.pow(u, 1.4);
    else if (k === 'fast') px = 14.2 - 1.25 * (1 - Math.pow(1 - u, 1.6));
    else if (k === 'intens') px = 12.95 - 0.05 * u;
    else if (k === 'solid') px = 12.9;
    else if (k === 'open') px = lerp(12.9, 12.35, ease(u));
    else if (k === 'eject') px = lerp(12.35, 17, ease(u));
    // 용탕량이 정상 중앙값 대비 많고 적음을 슬리브 채움량으로 표현 (±20% 제한)
    const mc = valOf(cur, 'molten_capacity'), m50 = o.mid('molten_capacity');
    const Vfull = 2.05 * (mc != null && m50 ? clamp(mc / m50, 0.8, 1.2) : 1);
    if (k === 'ladle') { Vol = Vfull * clamp((u - 0.56) / 0.28, 0, 1); metalOn = Vol > 0; }
    if (['slow', 'fast', 'intens', 'solid'].includes(k)) { Vol = Vfull; metalOn = true; }
    if (k === 'fast') fill = u; else if (k === 'intens' || k === 'solid') fill = 1;
    return { mx, px, V: Vol, fill, metalOn };
  }
  function ladlePos(i: number, u: number) {
    const R = [15.3, 6.9, 5.4], D = [FC[0] - 0.3, FC[1] - 0.2, 2.75], Pp = [15.4, 3.5, 4.0];
    const arc = (a: V, b: V, t: number, h: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + Math.sin(Math.PI * t) * h];
    if (PHASES[i].k !== 'ladle') return { p: R, full: 0, pour: 0 };
    if (u < 0.2) return { p: arc(R, D, ease(u / 0.2), 0.6), full: 0, pour: 0 };
    if (u < 0.3) return { p: D, full: (u - 0.2) / 0.1, pour: 0 };
    if (u < 0.52) return { p: arc(D, Pp, ease((u - 0.3) / 0.22), 2.2), full: 1, pour: 0 };
    if (u < 0.86) { const t = (u - 0.52) / 0.34; return { p: Pp, full: 1 - clamp((t - 0.1) / 0.85, 0, 1), pour: t > 0.08 && t < 0.97 ? 1 : 0 }; }
    return { p: arc(Pp, R, ease((u - 0.86) / 0.14), 1), full: 0, pour: 0 };
  }
  const R_IMP = 1.15, QP = Math.PI / 2;
  function robotAt(k: string, u: number, face: number) {
    const H = [9.4, 6.4, 4.6], A = [8.9, 2.5, 4.35], Gp = [face + 0.54, 2.5, 4.3], C = [7.2, BYC, 1.35], Cu = [7.2, BYC, 3.2];
    if (k === 'eject') {
      if (u < 0.12) return { tip: bez(H, [9.7, 4.6, 5.3], A, ease(seg(u, 0, 0.12))), a: 0 };
      if (u < 0.22) return { tip: V3.lerp(A, Gp, ease(seg(u, 0.12, 0.22))), a: 0 };
      if (u < 0.32) return { tip: Gp, a: 0 };
      if (u < 0.42) return { tip: V3.lerp(Gp, A, ease(seg(u, 0.32, 0.42))), a: 0 };
      if (u < 0.8) { const t = ease(seg(u, 0.42, 0.8)); return { tip: bez(A, [9.3, 5.9, 5.6], C, t), a: t * QP }; }
      if (u < 0.88) return { tip: C, a: QP };
      return { tip: V3.lerp(C, Cu, ease(seg(u, 0.88, 1))), a: QP };
    }
    if (k === 'spray' && u < 0.4) { const t = ease(u / 0.4); return { tip: bez(Cu, [8.8, 7.6, 5.2], H, t), a: (1 - t) * QP }; }
    return { tip: H, a: 0 };
  }
  function setRobot(rp: { tip: V; a: number }) {
    const n = [Math.cos(rp.a), 0, Math.sin(rp.a)], wr = V3.add(rp.tip, V3.mul(n, 0.7));
    const d = [wr[0] - RS[0], wr[1] - RS[1], wr[2] - RS[2]], h = Math.hypot(d[0], d[1]) || 1e-6, D = clamp(Math.hypot(h, d[2]), 0.3, RL1 + RL2 - 0.01);
    const al = Math.atan2(d[2], h), be = Math.acos(clamp((RL1 * RL1 + D * D - RL2 * RL2) / (2 * RL1 * D), -1, 1)), th = al + be;
    const elb = [RS[0] + (d[0] / h) * Math.cos(th) * RL1, RS[1] + (d[1] / h) * Math.cos(th) * RL1, RS[2] + Math.sin(th) * RL1];
    rb.u.set(RS, elb); rb.f.set(elb, wr); rb.w.set(wr, V3.add(rp.tip, V3.mul(n, 0.22)));
    const b = V3.add(rp.tip, V3.mul(n, 0.22)), t = V3.add(rp.tip, V3.mul(n, 0.02));
    rbG[0].set(V3.add(b, [0, -0.3, 0]), V3.add(b, [0, 0.3, 0])); rbG[1].set(V3.add(b, [0, -0.3, 0]), V3.add(t, [0, -0.3, 0])); rbG[2].set(V3.add(b, [0, 0.3, 0]), V3.add(t, [0, 0.3, 0]));
    [RS, elb, wr].forEach((p, j) => circleAt(rbJ[j], P(p)));
  }

  /* ---------- 라벨 표시값: 샷 값을 사이클 단계에 맞춰 연출 (사출 압력은 저속→고속→증압으로 상승) ---------- */
  const usesPrev = (id: FeatureKey, k: string) => !!prev && (
    (id === 'injection_pressure' && (k === 'close' || k === 'ladle')) ||
    (id === 'molten_capacity' && k === 'close') ||
    (id === 'biscuit_thickness' && ['close', 'ladle', 'slow', 'fast'].includes(k)));
  function labelTarget(id: FeatureKey, k: string, u: number): number | null {
    const v = valOf(cur, id), pv = prev ? valOf(prev, id) : v;
    if (usesPrev(id, k) && id !== 'injection_pressure') return pv;
    if (id === 'injection_pressure') {
      if (k === 'close' || k === 'ladle') return pv;
      if (v == null) return null;
      if (k === 'slow') return v * (0.02 + 0.04 * u);
      if (k === 'fast') return v * lerp(0.06, 0.45, u);
      if (k === 'intens') return v * lerp(0.45, 1, 1 - Math.exp(-u * 6));
      return v;
    }
    if (id === 'mechanical_strength' && k === 'close' && v != null && pv != null) return lerp(pv, v, ease(u));
    return v;
  }

  function enterPhase(i: number) {
    const k = PHASES[i].k;
    if (k === 'close') { prev = cur; cur = o.getShot() ?? cur; }
    if (k === 'open') part = { on: true };
    o.onPhase(i, cur);
  }

  function updateScene(i: number, u: number, dt: number, K: ReturnType<typeof kin>) {
    const k = PHASES[i].k, mx = K.mx, face = mx + 2.5;
    // 형체부
    movPlaten.set(mx, 0, 1.2, 1, 5, 6.3);
    movDie.set(mx + 1, 0.7, 1.8, 1.5, 3.6, 5.2); shoe.set(mx - 0.15, 4.55, 1.2, 1.3, 0.5, 0.3); tcM.set(face - 0.87, 2.38, 7.0, 0.24, 0.24, 0.16);
    { const d = face - 10, tf = `translate(${(-d * S * PAX).toFixed(1)},${(d * S * PBX).toFixed(1)})`; movDet.setAttribute('transform', tf); dieFace.setAttribute('transform', tf); }
    setTower(towerLevel());
    const half = (mx - 2.2) / 2, bend = Math.sqrt(Math.max(0, 2.65 * 2.65 - half * half)) * 0.6, kx = 2.2 + half, ty = 4.75;
    const up = [[2.2, ty, 6.2], [kx, ty, 6.2 - bend], [mx, ty, 6.2]], lo = [[2.2, ty, 2.4], [kx, ty, 2.4 + bend], [mx, ty, 2.4]], md = [up[1], [kx, ty, 4.3], lo[1]];
    [up, lo, md].forEach((pts, j) => { tgO[j].setAttribute('points', pstr(pts)); tgB[j].setAttribute('points', pstr(pts)); });
    xhead.set(kx - 0.4, 4.45, 3.9, 0.8, 0.45, 0.8);
    [...up, ...lo].forEach((p, j) => circleAt(tgPins[j], P(p)));
    [2.2, 6.6].forEach((z, j) => { tieFa[j].set([2.2, 4.4, z], [mx, 4.4, z]); tieFb[j].set([mx + 1, 4.4, z], [11.5, 4.4, z]); });
    // 도어
    setDoor(k === 'open' ? lerp(5, 0.2, ease(u)) : k === 'eject' || k === 'spray' ? 0.2 : k === 'close' ? lerp(0.2, 5, ease(u)) : 5);
    // 캐비티 (투시)
    const closed = ['ladle', 'slow', 'fast', 'intens', 'solid'].includes(k) || (k === 'close' && u > 0.98);
    let cavCol = '#f4431c', lvl = 0;
    if (k === 'fast') lvl = u; else if (k === 'intens' || k === 'solid') lvl = 1;
    if (k === 'solid') cavCol = u < 0.5 ? mix('f4431c', '8f2216', u * 2) : mix('8f2216', '8a9097', (u - 0.5) * 2);
    const RC = CAV.R * 1.03;
    cavRing.setAttribute('points', ringYZ(10, CAV.y, CAV.z, RC)); cavRing.setAttribute('opacity', closed ? '0.9' : '0');
    cavF.setAttribute('points', ringYZ(10, CAV.y, CAV.z, RC, 40, CAV.z - RC + 2 * RC * lvl));
    cavGlow.setAttribute('points', ringYZ(10, CAV.y, CAV.z, RC * 1.2, 40, CAV.z - RC * 1.2 + 2.4 * RC * lvl));
    runner.setAttribute('points', pstr([[10, 2.36, 2.3], [10, 2.64, 2.3], [10, 2.64, 3.2], [10, 2.36, 3.2]]));
    [cavF, runner].forEach(e => { e.setAttribute('fill', cavCol); e.setAttribute('opacity', closed && (lvl > 0 || K.fill > 0) ? '1' : '0'); });
    cavGlow.setAttribute('fill', cavCol); cavGlow.setAttribute('opacity', String(closed && lvl > 0 ? (k === 'solid' ? 0.55 * (1 - u) : 0.55) : 0));
    // 슬리브 용탕
    const Lm = K.px - 12.5, showMetal = K.metalOn && Lm > 0.05;
    metal.show(showMetal);
    if (showMetal) {
      const hgt = ['fast', 'intens', 'solid'].includes(k) ? 1.12 : Math.min(1.12, K.V / Math.max(0.4, Lm));
      metal.set(12.52, 1.94, 2.04, Lm, 1.12, hgt);
      if (k === 'solid') metal.color({ t: mix('ff7a3c', '8b8f95', u), x: mix('f4431c', '777b81', u), y: mix('c4300f', '63676d', u), s: mix('ff9a5a', '9aa0a6', u) });
      else metal.color(PAL.molten);
    }
    tip.set(K.px, 1.98, 2.08, 0.45, 1.04, 1.04);
    rod.set(K.px + 0.45, 2.25, 2.35, Math.max(0.1, 17.3 - K.px - 0.45), 0.5, 0.5);
    hydFlow.setAttribute('opacity', k === 'fast' || k === 'intens' ? '1' : '0');
    // 이형제 스프레이
    let hz = 8.4;
    if (k === 'spray') hz = u < 0.2 ? lerp(8.4, 3.2, ease(u / 0.2)) : u < 0.8 ? 3.2 + Math.sin(u * 28) * 0.35 : lerp(3.2, 8.4, ease((u - 0.8) / 0.2));
    sprN0.set([7.9, 2.5, hz + 0.3], 0.4, 0.13); sprBody.set([8.5, 2.5, hz], 0.62, 0.3); sprN1.set([8.7, 2.5, hz + 0.3], 0.4, 0.13);
    sprRod.set([8.5, 2.5, 9.5], [8.5, 2.5, hz + 0.6]);
    if (k === 'spray' && u > 0.18 && u < 0.8) for (let n = 0; n < 3; n++) mist.push({ x: 8.5, y: 2.2 + Math.random() * 0.6, z: hz + 0.3, vx: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.2), vz: -0.4 + Math.random() * 0.8, life: 0 });
    mist = mist.filter(m => (m.life += dt) < 0.7);
    mistG.innerHTML = mist.map(m => { m.x += m.vx * dt; m.z += m.vz * dt; const q = P([m.x, m.y, m.z]); return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(1.5 + m.life * 5).toFixed(1)}" fill="#7cc4ea" opacity="${(0.55 * (1 - m.life / 0.7)).toFixed(2)}"/>`; }).join('');
    // 급탕기
    const lp = ladlePos(i, u), [lx, ly, lz] = lp.p;
    ladle.set([lx, ly, lz], 0.62, 0.47);
    ladleMelt.setAttribute('points', ringXY([lx, ly, lz + 0.63], 0.37, 24));
    ladleMelt.setAttribute('opacity', String(lp.full > 0 ? 0.4 + 0.6 * lp.full : 0));
    const pv = [14.1, 6.4, 4.8], hand = [lx, ly, lz + 0.75], elb = [(pv[0] + lx) / 2, (pv[1] + ly) / 2, Math.max(pv[2], lz) + 1.6];
    ldArm[0].set(pv, elb); ldArm[1].set(elb, hand);
    [pv, elb].forEach((p, j) => circleAt(joints[j], P(p)));
    if (lp.pour) {
      const a = P([lx - 0.1, ly - 0.45, lz + 0.45]), b = P([15.85, 2.5, 3.2]), wob = Math.sin(performance.now() / 60) * 1.5;
      stream.setAttribute('points', `${a[0]},${a[1]} ${(a[0] + b[0]) / 2 + wob},${(a[1] + b[1]) / 2} ${b[0]},${b[1]}`); stream.setAttribute('opacity', '1');
    } else stream.setAttribute('opacity', '0');
    // 로봇 · 제품
    const ej = k === 'eject' ? Math.min(1, u / 0.2) * 0.12 : 0;
    const rp = robotAt(k, u, face + ej);
    setRobot(rp);
    updatePart(dt, face + ej, k, u, rp);
  }
  function updatePart(dt: number, face: number, k: string, u: number, rp: { tip: V; a: number }) {
    if (part.on && !part.belt) {
      if (k === 'open' || (k === 'eject' && u < 0.27)) { impDie.show(true); impGrip.show(false); impDie.set([face, 2.5, 4.3], 0, R_IMP, k === 'open' ? lerp(0.9, 0.6, u) : 0.6); }
      else if (k === 'eject' && u < 0.88) {
        impDie.show(false); impGrip.show(true);
        const n = [Math.cos(rp.a), 0, Math.sin(rp.a)];
        impGrip.set(V3.add(rp.tip, V3.mul(n, -0.42)), rp.a, R_IMP, lerp(0.6, 0.35, seg(u, 0.27, 0.88)));
      } else if (k === 'eject') { part.belt = true; part.x = 7.2; impGrip.show(false); }
      else { impDie.show(false); impGrip.show(false); }
    }
    if (part.belt && part.x != null) {
      part.x -= dt * 0.85;
      impBelt.show(true);
      impBelt.set([part.x, BYC, 0.9], QP, R_IMP, clamp((part.x - 3.5) / 3.7, 0, 1) * 0.35);
      if (part.x < BX0 + 0.2) { impBelt.show(false); part = {}; }
    }
    beltStripes.setAttribute('stroke-dashoffset', ((performance.now() / 1000) * 0.85 * S * 1.12).toFixed(1));
  }
  function updateLabels(i: number, u: number, dt: number, face: number) {
    const k = PHASES[i].k;
    for (const l of labels) {
      const v = labelTarget(l.id, k, u);
      const rec = usesPrev(l.id, k) ? prev : cur, st = o.statusOf(l.id, valOf(rec, l.id));
      if (v == null) { l.val.textContent = '—'; l.shown = NaN; }
      else {
        if (!Number.isFinite(l.shown)) l.shown = v;
        l.shown += (v - l.shown) * clamp(dt * (l.id === 'injection_pressure' ? 18 : 5), 0, 1);
        l.val.textContent = o.format(l.shown);
        l.unit.textContent = o.unit(l.id); l.val.appendChild(l.unit);
      }
      const live = l.id === 'injection_pressure' && ['slow', 'fast', 'intens'].includes(k);
      const tone = st === 'bad' ? c.alarm : st === 'warn' || st === 'na' ? c.warn : live ? c.live : '';
      l.g.setAttribute('class', `${c.lbl} ${tone}`);
      l.sb.textContent = rec ? STATUS_TEXT[st] : '';
      const a = P(anchorOf(l.id, face));
      l.lead.setAttribute('points', `${a[0]},${a[1]} ${clamp(a[0], l.bx, l.bx + W)},${clamp(a[1], l.by, l.by + Hh)}`);
      circleAt(l.anc, a); circleAt(l.ring, a);
    }
  }

  /* ---------- 메인 루프 ---------- */
  enterPhase(0);
  function frame(now: number) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const sdt = paused ? 0 : dt;
    pt += sdt;
    while (pt >= PHASES[phase].d) { pt -= PHASES[phase].d; phase = (phase + 1) % PHASES.length; enterPhase(phase); }
    const u = pt / PHASES[phase].d, K = kin(phase, u);
    updateScene(phase, u, sdt, K);
    updateLabels(phase, u, dt, K.mx + 2.5);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setPaused(p: boolean) { paused = p; },
    /** 화면을 떠날 때 반드시 호출 — 애니메이션 루프 정지·SVG 비움 (메모리 누수 방지) */
    destroy() { cancelAnimationFrame(raf); svg.innerHTML = ''; },
  };
}
