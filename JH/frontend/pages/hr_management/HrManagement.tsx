'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiError, FIELD_LABEL, GENDER_LABEL, TIER_LABEL, hrApi,
  type DeptSummary, type Employee, type EmployeeInput, type Me, type Summary, type TeamSummary,
} from './hrApi';
import po from '../process_optimization/ProcessOptimization.module.css';
import cd from '../company_documents/CompanyDocuments.module.css';
import s from './HrManagement.module.css';

type By = 'dept' | 'team';
const ALL = 'all';   // 「전체」 버튼 선택값 = 부서(또는 팀) 카드 전부 표시 — 인사팀(is_hr)만 보임
type Item = DeptSummary | TeamSummary;
const DETAIL_FIELDS = ['employee_no', 'employee_name', 'dept_name', 'position_name', 'team_name', 'email', 'phone',
  'years_of_service', 'annual_leave_used', 'monthly_overtime_hour', 'age', 'gender', 'address', 'created_at'];

const show = (k: string, v: unknown) =>
  v == null || v === '' ? '—' : k === 'gender' ? GENDER_LABEL[String(v)] ?? String(v)
    : k === 'created_at' ? new Date(String(v)).toLocaleString('sv-SE').slice(0, 16) : String(v);

/**
 * 인사 관리 — 부서별/팀별 정보 카드 → 명단 팝업(직급순) → 상세·수정·삭제, ＋ 사원 추가
 * 권한 = 로그인한 계정의 사번(관리자는 모든 권한). 서버(JH/api/hr/rules.py)가 판단하고, 볼 수 없는 칼럼은 응답에서 빠져서 옴
 */
export default function HrManagement() {
  const [me, setMe] = useState<Me | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [by, setBy] = useState<By>('dept');
  const [selected, setSelected] = useState<number | typeof ALL | null>(null);
  const [listKey, setListKey] = useState<number | null>(null);   // 명단 팝업을 연 카드 (부서·팀 코드)
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; emp: Employee } | null>(null);
  const [version, setVersion] = useState(0);     // 추가·수정·삭제 후 다시 조회

  // 로그인 계정 권한 → (열람 가능하면) 부서·팀 요약. 추가·수정·삭제 후 version 으로 다시 조회
  useEffect(() => {
    setError(null);
    hrApi.me()
      .then(m => { setMe(m); return m.tier ? hrApi.summary() : null; })
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, [version]);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  const items = summary ? (by === 'dept' ? summary.departments : summary.teams) : [];
  const keyOf = (x: (typeof items)[number]) => ('dept_code' in x ? x.dept_code : x.team_code);
  const showAll = !!me?.is_hr;
  // 화면에 보일 카드: 「전체」면 탭의 카드 전부, 아니면 고른 하나
  const shown = selected === ALL && showAll ? items : items.filter(x => keyOf(x) === selected);
  const listItem = items.find(x => keyOf(x) === listKey) ?? null;

  return (
    <div className={po.page}>
      <header className={po.head}>
        <div>
          <div className={po.crumb}>인사 관리</div>
          <h2 className={po.title}>인사 관리</h2>
        </div>
        <div className={s.headRight}>
          <button type="button" className={cd.addBtn} disabled={!me?.can_create} onClick={() => setForm({ mode: 'create' })}
            aria-label="사원 추가" title={me?.can_create ? '사원 추가' : '권한 없음 — 인사팀(경영부)·팀 대표만 추가할 수 있습니다'}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      <div className={po.banner}>
        {me ? <>로그인 계정: <b>{me.employee_no === 'admin' ? '관리자 (모든 권한)' : me.employee_no}</b> · 현재 권한: <b>{me.scope === 'all' ? '전 직원' : me.scope === 'team' ? `${me.team_name ?? '팀 없음'} 팀만` : '열람 불가'}</b>
          {me.tier && <> · 열람 등급 <b>{TIER_LABEL[me.tier]}</b></>}</> : '로그인 계정 권한 확인 중…'}
        {' '}· 데이터는 NCP DB 원본(실시간)이며, 조회·변경은 모두 기록됩니다.
      </div>
      {error && <div className={po.errorBox} role="alert">{error}</div>}
      {me && !me.tier && <div className={po.errorBox} role="alert">인턴은 인사 정보를 열람할 수 없습니다.</div>}

      {summary && (
        <>
          <div className={cd.categories} role="group" aria-label="분류">
            {(['dept', 'team'] as By[]).map(b => (
              <button key={b} type="button" aria-pressed={by === b} className={`${cd.catBtn} ${by === b ? cd.catOn : ''}`}
                onClick={() => { setBy(b); setSelected(null); setListKey(null); }}>{b === 'dept' ? '부서별' : '팀별'}</button>
            ))}
          </div>
          <div className={cd.categories} role="group" aria-label={by === 'dept' ? '부서 선택' : '팀 선택'}>
            {showAll && (
              <button type="button" aria-pressed={selected === ALL}
                className={`${cd.catBtn} ${selected === ALL ? cd.catOn : ''}`} onClick={() => setSelected(ALL)}>
                전체
              </button>
            )}
            {items.map(x => (
              <button key={keyOf(x)} type="button" aria-pressed={selected === keyOf(x)}
                className={`${cd.catBtn} ${selected === keyOf(x) ? cd.catOn : ''}`} onClick={() => setSelected(keyOf(x))}>
                {'dept_name' in x ? x.dept_name : x.team_name} <span className={po.num}>{x.headcount}명</span>
              </button>
            ))}
          </div>

          {shown.length > 0 ? (
            <div className={shown.length > 1 ? s.cardGrid : undefined}>
              {shown.map(x => (
                <InfoCard key={keyOf(x)} item={x} positions={summary.positions} onOpen={() => setListKey(keyOf(x))} />
              ))}
            </div>
          ) : (
            <p className={po.sub}>{by === 'dept' ? '부서' : '팀'}를 선택하면 정보가 표시됩니다.</p>
          )}
        </>
      )}

      {listItem && me && (
        <ListDialog me={me} by={by} keyValue={keyOf(listItem)}
          title={'dept_name' in listItem ? listItem.dept_name : listItem.team_name} version={version}
          onEdit={emp => setForm({ mode: 'edit', emp })} onChanged={refresh} onClose={() => setListKey(null)} />
      )}
      {form && me && summary && (
        <EmployeeForm me={me} summary={summary} editing={form.mode === 'edit' ? form.emp : null}
          onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />
      )}
    </div>
  );
}

/** 부서·팀 정보 카드 — 누르면 명단 팝업 (열람 권한 없으면 비활성) */
function InfoCard({ item, positions, onOpen }: { item: Item; positions: Summary['positions']; onOpen: () => void }) {
  const chips = 'by_position' in item
    ? positions.filter(p => item.by_position[p.position_name]).map(p => [p.position_name, item.by_position[p.position_name]] as const)
    : Object.entries(item.by_dept);
  return (
    <button type="button" className={`${po.panel} ${s.card}`} disabled={!item.can_view} onClick={onOpen}
      aria-label={item.can_view ? '전체 명단 보기' : '열람 권한 없음'}>
      <div className={s.cardHead}>
        <h3>{'dept_name' in item ? item.dept_name : item.team_name}</h3>
        <span className={po.sub}>{item.can_view ? '눌러서 전체 명단 보기 →' : '열람 권한 없음 (자기 팀만 볼 수 있습니다)'}</span>
      </div>
      <dl className={cd.meta}>
        <dt>대표</dt>
        <dd>{item.rep_no ? `${item.rep_no} · ${item.rep_position ?? ''}` : '—'}</dd>
        <dt>인원</dt><dd className={po.num}>{item.headcount}명</dd>
        <dt>{'by_position' in item ? '직급별' : '소속 부서별'}</dt>
        <dd className={s.chips}>{chips.map(([k, n]) => <span key={k} className={po.chip}>{k} <b>{n}</b></span>)}</dd>
      </dl>
    </button>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** 명단 팝업 — 직급 높은 순(서버 정렬). 행을 누르면 상세 */
function ListDialog({ me, by, keyValue, title, version, onEdit, onChanged, onClose }: {
  me: Me; by: By; keyValue: number; title: string; version: number;
  onEdit: (e: Employee) => void; onChanged: () => void; onClose: () => void;
}) {
  const [rows, setRows] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Employee | null>(null);
  useEscape(opened ? () => setOpened(null) : onClose);

  useEffect(() => {
    setRows(null);
    hrApi.list(by, keyValue).then(setRows).catch((e: Error) => setError(e.message));
  }, [by, keyValue, version]);

  const showPhone = me.visible_fields.includes('phone');
  return (
    <div className={po.backdrop} onClick={onClose}>
      <div className={`${po.dialog} ${s.wide}`} role="dialog" aria-modal="true" aria-labelledby="hr-list-title" onClick={e => e.stopPropagation()}>
        <div className={po.dialogHead}>
          <b id="hr-list-title">{title} 명단</b>
          <span className={po.sub}>{rows ? `${rows.length}명 · 직급 높은 순` : '불러오는 중…'}</span>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기">×</button>
        </div>
        {error && <p className={cd.err} role="alert">{error}</p>}
        {rows && (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr><th>사번</th><th>이름</th><th>직급</th><th>{by === 'dept' ? '팀' : '부서'}</th><th>사내 이메일</th>{showPhone && <th>전화번호</th>}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.employee_no} tabIndex={0} onClick={() => setOpened(r)} onKeyDown={e => { if (e.key === 'Enter') setOpened(r); }}>
                    <td className={po.num}>{r.employee_no}</td>
                    <td>{r.employee_name}{(r.is_dept_rep || r.is_team_rep) && <span className={s.rep}>{r.is_dept_rep ? '부서 대표' : '팀 대표'}</span>}</td>
                    <td>{r.position_name}</td>
                    <td>{by === 'dept' ? r.team_name ?? '—' : r.dept_name}</td>
                    <td>{r.email}</td>
                    {showPhone && <td className={po.num}>{r.phone ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {opened && (
          <DetailDialog emp={opened} onClose={() => setOpened(null)}
            onEdit={() => { onEdit(opened); setOpened(null); }}
            onDeleted={() => { setOpened(null); onChanged(); }} />
        )}
      </div>
    </div>
  );
}

/** 사원 상세 — 서버가 보낸(볼 권한 있는) 칼럼만 표시 */
function DetailDialog({ emp, onClose, onEdit, onDeleted }: {
  emp: Employee; onClose: () => void; onEdit: () => void; onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = DETAIL_FIELDS.filter(k => k in emp);

  async function remove() {
    if (!window.confirm(`${emp.employee_no} ${emp.employee_name} 사원을 삭제할까요?\n개인정보·명단·권한 코드가 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    setBusy(true); setError(null);
    try { await hrApi.remove(emp.employee_no); onDeleted(); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className={po.backdrop} onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className={po.dialog} role="dialog" aria-modal="true" aria-labelledby="hr-detail-title" onClick={e => e.stopPropagation()}>
        <div className={po.dialogHead}>
          <b id="hr-detail-title">{emp.employee_name}</b>
          <span className={`${po.sub} ${po.num}`}>{emp.employee_no}</span>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기" autoFocus>×</button>
        </div>
        <dl className={cd.meta}>
          {fields.map(k => (
            <div key={k} className={s.metaRow}><dt>{FIELD_LABEL[k]}</dt><dd>{show(k, emp[k as keyof Employee])}</dd></div>
          ))}
        </dl>
        {error && <p className={cd.err} role="alert">{error}</p>}
        {emp.can_edit && (
          <div className={cd.actions}>
            <button type="button" className={cd.deleteBtn} onClick={remove} disabled={busy}>{busy ? '삭제 중…' : '삭제'}</button>
            <button type="button" className={cd.primaryBtn} onClick={onEdit}>수정</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 사원 추가·수정 — 사번·등록 일시는 서버 자동. 팀 대표는 팀이 자기 팀으로 고정 */
function EmployeeForm({ me, summary, editing, onClose, onSaved }: {
  me: Me; summary: Summary; editing: Employee | null; onClose: () => void; onSaved: () => void;
}) {
  const teamLocked = !me.is_hr;
  const [v, setV] = useState({
    // select 값은 문자열 → 저장할 때 숫자로 바꿈
    dept_code: String(editing?.dept_code ?? (teamLocked ? me.dept_code : '')),
    position_name: editing?.position_name ?? '',
    team_code: String(editing ? editing.team_code ?? '' : teamLocked ? me.team_code ?? '' : ''),
    employee_name: editing?.employee_name ?? '',
    birth_date: editing?.birth_date ?? '',
    gender: editing?.gender ?? '',
    phone: editing?.phone ?? '',
    address: editing?.address ?? '',
    email: editing?.email ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEscape(onClose);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV(x => ({ ...x, [k]: e.target.value }));

  // 수정 시 권한 등급 때문에 받지 못한 칼럼(예: 관리 등급의 주소)은 보내지 않음 → 기존 값 유지
  const hidden = (k: string) => editing != null && !(k in editing);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErrors({}); setMessage(null);
    const body: EmployeeInput = {
      dept_code: Number(v.dept_code), position_name: v.position_name, team_code: v.team_code ? Number(v.team_code) : null,
      employee_name: v.employee_name, birth_date: v.birth_date, gender: v.gender, phone: v.phone, address: v.address, email: v.email,
    };
    try {
      if (editing) {
        const patch = Object.fromEntries(Object.entries(body).filter(([k]) => !hidden(k)));
        await hrApi.update(editing.employee_no, patch);
      } else {
        await hrApi.create(body);
      }
      onSaved();
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fields ?? {});
      setMessage(ae.message);   // 실패해도 입력값 유지
      setSaving(false);
    }
  }

  const field = (k: keyof typeof v, label: string, input: React.ReactNode) => hidden(k) ? null : (
    <label className={cd.field}>
      <span>{label} <em>*</em></span>
      {input}
      {errors[k] && <small className={cd.err}>{errors[k]}</small>}
    </label>
  );

  return (
    <div className={po.backdrop} onClick={onClose}>
      <form className={`${po.dialog} ${cd.dialog}`} role="dialog" aria-modal="true" aria-labelledby="hr-form-title"
        onClick={e => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className={po.dialogHead}>
          <b id="hr-form-title">{editing ? `사원 수정 · ${editing.employee_no}` : '사원 추가'}</b>
          <span className={po.sub}>{editing ? '' : '사번(E+부서코드+순번)·등록 일시는 자동'}</span>
          <button type="button" className={po.closeBtn} onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className={cd.form}>
          <div className={cd.row3}>
            {field('dept_code', '부서', (
              <select value={v.dept_code} onChange={set('dept_code')} aria-invalid={!!errors.dept_code}>
                <option value="">선택</option>
                {summary.departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.dept_name}</option>)}
              </select>
            ))}
            {field('position_name', '직급', (
              <select value={v.position_name} onChange={set('position_name')} aria-invalid={!!errors.position_name}>
                <option value="">선택</option>
                {summary.positions.map(p => <option key={p.position_name} value={p.position_name}>{p.position_name}</option>)}
              </select>
            ))}
            <label className={cd.field}>
              <span>팀</span>
              <select value={v.team_code} onChange={set('team_code')} disabled={teamLocked} aria-invalid={!!errors.team_code}>
                {!teamLocked && <option value="">없음</option>}
                {summary.teams.filter(t => !teamLocked || t.team_code === me.team_code)
                  .map(t => <option key={t.team_code} value={t.team_code}>{t.team_name}</option>)}
              </select>
              {teamLocked && <small className={po.sub}>팀 대표는 자기 팀으로만 추가·수정</small>}
              {errors.team_code && <small className={cd.err}>{errors.team_code}</small>}
            </label>
          </div>
          <div className={cd.row3}>
            {field('employee_name', '이름', <input value={v.employee_name} maxLength={50} onChange={set('employee_name')} aria-invalid={!!errors.employee_name} />)}
            {/* 나이는 서버가 생년월일로 계산 (만 15~100세만 허용) */}
            {field('birth_date', '생년월일', <input type="date" value={v.birth_date} max={new Date().toLocaleDateString('sv-SE')} onChange={set('birth_date')} aria-invalid={!!errors.birth_date} />)}
            {field('gender', '성별', (
              <select value={v.gender} onChange={set('gender')} aria-invalid={!!errors.gender}>
                <option value="">선택</option>
                {Object.entries(GENDER_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            ))}
          </div>
          {field('phone', '전화번호', <input value={v.phone} placeholder="010-1234-5678" onChange={set('phone')} aria-invalid={!!errors.phone} />)}
          {field('address', '주소', <input value={v.address} maxLength={200} onChange={set('address')} aria-invalid={!!errors.address} />)}
          {field('email', '사내 이메일', <input type="email" value={v.email} maxLength={100} onChange={set('email')} aria-invalid={!!errors.email} />)}
        </div>
        {message && <p className={cd.err} role="alert">{message}</p>}
        <div className={cd.actions}>
          <button type="button" className={po.btn} onClick={onClose}>취소</button>
          <button type="submit" className={cd.primaryBtn} disabled={saving}>{saving ? '저장 중…' : editing ? '저장' : '추가'}</button>
        </div>
      </form>
    </div>
  );
}
