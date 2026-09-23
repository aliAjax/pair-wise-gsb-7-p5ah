// 页面：后台标牌管理与访客短码入口。资料形状来自 labelData，规则来自 labelRules。
import React, { useMemo, useState } from 'react';
import { BATCH_STATUS, formatCode } from './labelData';
import { MAX_BATCH_SIZE, issueBatch, resolveCode } from './labelRules';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—');

export function LabelAdmin({ exhibits, data, onChange, onNotice }) {
  const published = exhibits.filter((x) => x.status === '已发布');
  const [exhibitId, setExhibitId] = useState('');
  const [hall, setHall] = useState('');
  const [printer, setPrinter] = useState('');
  const [count, setCount] = useState(10);
  const [error, setError] = useState('');
  const [openBatch, setOpenBatch] = useState(null);
  const batches = useMemo(() => [...data.batches].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [data.batches]);
  const exhibitOf = (id) => exhibits.find((x) => x.id === id);
  const submit = () => {
    const exhibit = exhibits.find((x) => String(x.id) === String(exhibitId));
    const res = issueBatch(data, exhibit, { hall, printedBy: printer, count });
    if (!res.ok) { setError(res.error); return; }
    setError('');
    onChange(res.data);
    onNotice?.(`已生成 ${res.labels.length} 张标牌`);
    setOpenBatch(res.batch.id);
  };
  return (
    <main className="workspace">
      <header className="topbar"><div><span className="eyebrow">LABEL BATCHES</span><h1>二维码标牌</h1></div></header>
      <div className="label-admin">
        <section className="issue-panel">
          <div className="panel-title"><div><span className="eyebrow">NEW BATCH</span><h2>生成标牌批次</h2></div></div>
          <label>展项（仅已发布）
            <select value={exhibitId} onChange={(e) => setExhibitId(e.target.value)}>
              <option value="">请选择展项</option>
              {published.map((x) => <option key={x.id} value={x.id}>{x.title} · {x.room}</option>)}
            </select>
          </label>
          {published.length === 0 && <p className="hint">暂无已发布展项，请先在「展项内容」中发布。</p>}
          <div className="two">
            <label>展厅<input value={hall} placeholder="如 A01 · 主展厅" onChange={(e) => setHall(e.target.value)} /></label>
            <label>打印人<input value={printer} placeholder="经办人姓名" onChange={(e) => setPrinter(e.target.value)} /></label>
          </div>
          <label>数量（每批 1–{MAX_BATCH_SIZE} 张）<input type="number" min="1" max={MAX_BATCH_SIZE} value={count} onChange={(e) => setCount(e.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" onClick={submit}>生成批次</button>
          <p className="hint">短码全馆唯一，不随批次复用；展项撤展后本批立即失效，重新布展需新建批次。</p>
        </section>
        <section className="batch-list">
          {batches.length === 0 && <p className="empty">还没有标牌批次。为已发布展项生成第一批标牌。</p>}
          {batches.map((b) => {
            const ex = exhibitOf(b.exhibitId);
            const labels = data.labels.filter((l) => l.batchId === b.id);
            const active = b.status === BATCH_STATUS.ACTIVE;
            const open = openBatch === b.id;
            return (
              <article className={'batch-card' + (active ? '' : ' dead')} key={b.id}>
                <button className="batch-head" onClick={() => setOpenBatch(open ? null : b.id)}>
                  <span className="batch-copy">
                    <strong>{ex ? ex.title : '展项已删除'}</strong>
                    <small>批次 {b.id} · {labels.length} 张 · 生成于 {fmtTime(b.createdAt)}</small>
                    {!active && <small>失效于 {fmtTime(b.revokedAt)}</small>}
                  </span>
                  <span className={'status ' + (active ? 'live' : 'draft')}>{active ? '有效' : '已失效'}</span>
                  <span className="chev">{open ? '⌃' : '›'}</span>
                </button>
                {open && (
                  <table className="label-table">
                    <thead><tr><th>短码</th><th>展厅</th><th>打印人</th></tr></thead>
                    <tbody>
                      {labels.map((l) => (
                        <tr key={l.code}><td><code className="code-chip">{formatCode(l.code)}</code></td><td>{l.hall}</td><td>{l.printedBy}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

export function CodeEntry({ data, exhibits, onOpen }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const res = resolveCode(data, exhibits, value);
    if (!res.ok) { setMessage(res.message); return; }
    setMessage('');
    setValue('');
    onOpen(res.exhibit);
  };
  return (
    <form className="code-entry" onSubmit={submit}>
      <div className="code-entry-copy"><span className="eyebrow">LABEL CODE</span><strong>有标牌短码？输入后直达展项</strong></div>
      <div className="code-entry-row">
        <input value={value} onChange={(e) => { setValue(e.target.value); setMessage(''); }} placeholder="如 K7M-2QD" autoCapitalize="characters" autoComplete="off" maxLength={8} />
        <button className="primary" type="submit">打开</button>
      </div>
      {message && <p className="code-error">{message}</p>}
    </form>
  );
}
