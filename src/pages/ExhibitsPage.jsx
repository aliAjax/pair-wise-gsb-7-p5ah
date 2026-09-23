import React, { useMemo, useState } from 'react';

const COLORS = ['#e6b45d', '#ef8f84', '#83b9b1', '#9ba7dc'];
const FILTERS = ['全部', '已发布', '草稿', '已撤展'];

// 后台展项编辑页。发布 / 撤回 / 撤展是三个不同动作：
// 发布：当前导览内容对访客生效，可去标牌页生成批次；
// 撤展：内容下线且该展项所有标牌立即失效（历史保留）；重新布展需重新发布并新建批次；
// 撤回发布：退回草稿，已启用标牌同步作废，访客不会扫到草稿。
export default function ExhibitsPage({
  exhibits, selectedId, onSelect, onUpdate, onAdd, onWithdraw, onUnpublish, onNotice,
}) {
  const [filter, setFilter] = useState('全部');
  const [form, setForm] = useState({ title: '', room: '', desc: '' });

  const visible = useMemo(
    () => (filter === '全部' ? exhibits : exhibits.filter((x) => x.status === filter)),
    [exhibits, filter],
  );
  const current = exhibits.find((x) => x.id === selectedId) || exhibits[0];

  const add = () => {
    if (!form.title.trim()) { onNotice('请先填写展项标题'); return; }
    const item = {
      ...form,
      id: Date.now(),
      type: '装置',
      audio: '',
      status: '草稿',
      color: COLORS[exhibits.length % COLORS.length],
    };
    onAdd(item);
    setForm({ title: '', room: '', desc: '' });
    onNotice('展项已保存为草稿，发布后才能生成标牌');
  };

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exhibits, null, 2)], { type: 'application/json' }));
    a.download = 'exhibition-guide.json';
    a.click();
    onNotice('已导出展项数据');
  };

  const publish = () => {
    // 重新布展：已撤展的展项再次发布，只影响内容；旧批次仍然失效，必须新建标牌
    onUpdate(current.id, { status: '已发布' });
    onNotice(current.status === '已撤展'
      ? '已重新发布，请新建标牌批次；旧批次保持失效'
      : '已发布，访客预览已更新');
  };

  return (
    <div className="content">
      <section className="list-pane">
        <div className="list-head">
          <div><h2>全部展项</h2><span>{exhibits.length} 个展项</span></div>
          <button className="add-btn" onClick={() => document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' })}>＋ 添加展项</button>
        </div>
        <div className="filters">
          {FILTERS.map((x) => (
            <button key={x} className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)}>{x}</button>
          ))}
        </div>
        <div className="exhibit-list">
          {visible.map((x) => (
            <button key={x.id} className={'exhibit-row ' + (current && selectedId === x.id ? 'chosen' : '')} onClick={() => onSelect(x.id)}>
              <span className="thumb" style={{ background: x.color }}>{String(x.id).slice(-2).padStart(2, '0')}</span>
              <span className="row-copy">
                <strong>{x.title}</strong>
                <small>{x.room} · {x.type}</small>
              </span>
              <span className={'status ' + (x.status === '已发布' ? 'live' : x.status === '已撤展' ? 'off' : 'draft')}>{x.status}</span>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      </section>

      <section className="form-panel">
        {current && (
          <>
            <div className="panel-title">
              <div><span className="eyebrow">EDIT EXHIBIT</span><h2>编辑展项</h2></div>
              <span className={'status ' + (current.status === '已发布' ? 'live' : current.status === '已撤展' ? 'off' : 'draft')}>{current.status}</span>
            </div>
            <div className="editor">
              <label>展项标题
                <input value={current.title} onChange={(e) => onUpdate(current.id, { title: e.target.value })} />
              </label>
              <div className="two">
                <label>所在展厅
                  <input value={current.room} onChange={(e) => onUpdate(current.id, { room: e.target.value })} />
                </label>
                <label>内容类型
                  <select value={current.type} onChange={(e) => onUpdate(current.id, { type: e.target.value })}>
                    {['装置', '档案', '互动', '绘画'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label>展项介绍
                <textarea rows="5" value={current.desc} onChange={(e) => onUpdate(current.id, { desc: e.target.value })} />
              </label>
              <label>语音导览 URL
                <input value={current.audio} placeholder="https://…" onChange={(e) => onUpdate(current.id, { audio: e.target.value })} />
                <small className="hint">仅在展项已发布时，访客扫描有效标牌后可播放</small>
              </label>

              <div className="lifecycle">
                {current.status !== '已发布' && (
                  <button className="primary" onClick={publish}>
                    {current.status === '已撤展' ? '↻ 重新发布（重新布展）' : '发布更新'} <span>↗</span>
                  </button>
                )}
                {current.status === '已发布' && (
                  <>
                    <button className="secondary" onClick={() => { onUnpublish(current.id); onNotice('已撤回发布，相关标牌同步作废'); }}>撤回发布</button>
                    <button className="danger" onClick={() => { onWithdraw(current.id); onNotice('展项已撤展，该展项标牌全部立即失效'); }}>撤展并作废旧标牌</button>
                  </>
                )}
                {current.status === '已撤展' && (
                  <p className="state-note">已撤展：历史标牌批次保留可查但不可扫描；重新布展请重新发布并新建批次。</p>
                )}
                {current.status === '草稿' && (
                  <p className="state-note">草稿内容不会出现在任何标牌扫描结果中。</p>
                )}
              </div>

              <div className="preview-block">
                <div className="preview-heading">
                  <span>访客链接</span>
                  <button onClick={() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/visitor`); onNotice('访客首页链接已复制'); }}>复制链接</button>
                </div>
                <div className="qr-preview">
                  <div className="qr-box big">▦</div>
                  <div>
                    <strong>展项-{String(current.id).padStart(3, '0')}</strong>
                    <small>具体短码在「二维码标牌」中生成</small>
                  </div>
                </div>
              </div>
              <button className="secondary" onClick={exportData}>↓ 导出 JSON</button>
            </div>
          </>
        )}

        <div className="new-form">
          <div className="panel-title"><div><span className="eyebrow">NEW ENTRY</span><h2>快速添加展项</h2></div></div>
          <div className="two">
            <input placeholder="展项标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder="展厅编号" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          <textarea placeholder="一句话介绍…" rows="2" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          <button className="primary full" onClick={add}>保存新展项</button>
        </div>
      </section>
    </div>
  );
}
