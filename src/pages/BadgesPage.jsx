import React, { useMemo, useState } from 'react';
import { BATCH_STATUS, normalizeCode } from '../badges/model.js';
import { resolveCode } from '../badges/rules.js';

const fmt = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 标牌管理：资料（短码/展厅/打印人）展示、批次生命周期操作都在这里，
// 所有“能不能做”的判断都来自 badges/rules.js，本页只收集输入和显示结果。
export default function BadgesPage({
  exhibits, batches, onIssue, onEnable, onInvalidate, onWithdraw, onNotice,
}) {
  const published = exhibits.filter((x) => x.status === '已发布');
  const [exhibitId, setExhibitId] = useState(published[0]?.id ?? '');
  const [count, setCount] = useState(10);
  const [printer, setPrinter] = useState('');
  const [roomOverride, setRoomOverride] = useState('');
  const [roomTouched, setRoomTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [openId, setOpenId] = useState(batches[0]?.id ?? null);
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState(null);

  const chosen = exhibits.find((x) => x.id === Number(exhibitId));
  const effectiveRoom = roomTouched ? roomOverride : chosen?.room ?? '';

  const selectExhibit = (id) => {
    setExhibitId(id);
    setRoomTouched(false);
    setRoomOverride('');
  };

  const submit = () => {
    const result = onIssue(Number(exhibitId), { count: Number(count), printer, room: effectiveRoom });
    if (result.ok) {
      setFormError('');
      setPrinter('');
    } else {
      setFormError(result.message);
    }
  };

  const runCheck = () => {
    const code = normalizeCode(checkCode);
    if (!code) { setCheckResult(null); return; }
    setCheckResult(resolveCode({ exhibits, batches }, code));
  };

  const copyAll = (batch) => {
    navigator.clipboard?.writeText(batch.codes.join('\n'));
    onNotice(`已复制 ${batch.codes.length} 个短码`);
  };

  const grouped = useMemo(() => {
    const byExhibit = new Map();
    batches.forEach((b) => {
      const list = byExhibit.get(b.exhibitId) || [];
      list.push(b);
      byExhibit.set(b.exhibitId, list);
    });
    return [...byExhibit.entries()].map(([id, list]) => ({
      exhibit: exhibits.find((x) => x.id === id),
      list: list.sort((a, b) => b.createdAt - a.createdAt),
    }));
  }, [batches, exhibits]);

  return (
    <div className="content badges-content">
      <section className="list-pane">
        <div className="list-head">
          <div><h2>批次历史</h2><span>{batches.length} 批 · 全部留档可核对</span></div>
        </div>

        <div className="code-check">
          <span className="eyebrow">现场核对</span>
          <div className="check-row">
            <input
              placeholder="输入标牌短码"
              value={checkCode}
              onChange={(e) => setCheckCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runCheck()}
            />
            <button className="secondary" onClick={runCheck}>核对</button>
          </div>
          {checkResult && (
            checkResult.ok ? (
              <p className="check-ok">✓ {checkResult.exhibit.title} · {checkResult.exhibit.room}（有效）</p>
            ) : (
              <p className="check-bad">✕ {reasonText(checkResult.reason)}</p>
            )
          )}
        </div>

        <div className="batch-groups">
          {grouped.map(({ exhibit, list }) => (
            <div className="batch-group" key={exhibit?.id ?? 'gone'}>
              <div className="batch-group-head">
                <strong>{exhibit ? exhibit.title : '展项已删除'}</strong>
                {exhibit && <span className={'status ' + (exhibit.status === '已发布' ? 'live' : exhibit.status === '已撤展' ? 'off' : 'draft')}>{exhibit.status}</span>}
              </div>
              {list.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  exhibitTitle={exhibit?.title}
                  exhibitStatus={exhibit?.status}
                  open={openId === b.id}
                  onToggle={() => setOpenId(openId === b.id ? null : b.id)}
                  onEnable={() => onEnable(b.id)}
                  onInvalidate={() => onInvalidate(b.id)}
                  onWithdraw={() => { onWithdraw(b.exhibitId); onNotice('展项已撤展，该批次立即失效'); }}
                  onCopy={() => copyAll(b)}
                  onNotice={onNotice}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="form-panel">
        <div className="panel-title">
          <div><span className="eyebrow">NEW BATCH</span><h2>生成标牌批次</h2></div>
        </div>
        {published.length === 0 ? (
          <p className="state-note">当前没有已发布展项。请先在「展项内容」中发布，再来生成标牌。</p>
        ) : (
          <div className="editor">
            <label>展项（仅已发布）
              <select value={exhibitId} onChange={(e) => selectExhibit(e.target.value)}>
                {published.map((x) => <option key={x.id} value={x.id}>{x.title} · {x.room}</option>)}
              </select>
            </label>
            <div className="two">
              <label>标牌数量
                <input type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} />
              </label>
              <label>打印人
                <input placeholder="如：林晓" value={printer} onChange={(e) => setPrinter(e.target.value)} />
              </label>
            </div>
            <label>展厅（标牌上显示，默认取展项展厅）
              <input value={effectiveRoom} onChange={(e) => { setRoomTouched(true); setRoomOverride(e.target.value); }} />
            </label>
            {formError && <p className="form-error">✕ {formError}</p>}
            <button className="primary full" onClick={submit}>生成批次（待启用）</button>
            <p className="state-note">
              新批次为「待启用」，标牌打印完成、现场核对无误后再手动启用；启用时会逐码校验，
              短码一旦出现在某有效批次中，其他批次不得再使用。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const REASON_TEXT = {
  NOT_FOUND: '未找到该短码，请核对标牌',
  NOT_ENABLED: '该标牌批次尚未启用',
  WITHDRAWN: '该标牌已随展项撤展作废',
  REVOKED: '该标牌批次已作废',
  NOT_PUBLISHED: '内容暂未发布',
};
const reasonText = (r) => REASON_TEXT[r] || REASON_TEXT.NOT_FOUND;

function BatchCard({ batch, exhibitTitle, exhibitStatus, open, onToggle, onEnable, onInvalidate, onWithdraw, onCopy, onNotice }) {
  const cls = batch.status === BATCH_STATUS.ACTIVE ? 'live' : batch.status === BATCH_STATUS.INVALID ? 'off' : 'draft';
  return (
    <div className={'batch-card ' + cls}>
      <button className="batch-head" onClick={onToggle}>
        <span className="batch-id">{batch.id}</span>
        <span className="batch-meta">{batch.codes.length} 枚 · {batch.printer} · {fmt(batch.createdAt)}</span>
        <span className={'status ' + cls}>{batch.status}</span>
        <span className="chev">{open ? '⌄' : '›'}</span>
      </button>
      {open && (
        <div className="batch-body">
          <div className="batch-fields">
            <span>展厅：{batch.room}</span>
            <span>打印人：{batch.printer}</span>
            <span>启用：{fmt(batch.enabledAt)}</span>
            {batch.status === BATCH_STATUS.INVALID && <span>失效：{fmt(batch.invalidAt)}（{batch.invalidReason}）</span>}
          </div>
          <div className="badge-grid">
            {batch.codes.map((code) => (
              <div className="badge-plate" key={code}>
                <div className="qr-box small">▦</div>
                <div className="plate-copy">
                  <strong>{code}</strong>
                  <small>{batch.room}</small>
                </div>
                <button className="plate-copy-btn" title="复制短码" onClick={() => { navigator.clipboard?.writeText(code); onNotice(`短码 ${code} 已复制`); }}>⧉</button>
              </div>
            ))}
          </div>
          <div className="batch-actions">
            <button className="secondary" onClick={onCopy}>复制全部短码</button>
            {batch.status === BATCH_STATUS.PENDING && (
              <button className="primary" onClick={onEnable}>核对无误，启用批次</button>
            )}
            {batch.status === BATCH_STATUS.ACTIVE && (
              <>
                <button className="secondary warn" onClick={onInvalidate}>作废旧批次（留档）</button>
                {exhibitStatus === '已发布' && (
                  <button className="danger" onClick={onWithdraw}>展项撤展（整展项失效）</button>
                )}
              </>
            )}
            {batch.status === BATCH_STATUS.INVALID && (
              <small className="state-note">历史批次，仅可查看，不可再扫{exhibitTitle ? `；${exhibitTitle}重新布展需新建批次` : ''}。</small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
