import React, { useEffect, useState } from 'react';

const REASON_TEXT = {
  NOT_FOUND: { title: '未找到这个标牌', body: '短码无法识别，请核对标牌上的字符后再试。' },
  NOT_ENABLED: { title: '标牌尚未启用', body: '这批标牌还没有正式启用，请留意展厅工作人员的通知。' },
  WITHDRAWN: { title: '展项已撤展', body: '该标牌已随展项撤展作废，不能继续导览；重新布展会使用新的标牌。' },
  REVOKED: { title: '标牌已作废', body: '这批标牌已被工作人员作废，无法继续使用。' },
  NOT_PUBLISHED: { title: '内容暂未开放', body: '该展项目前没有公开发布，请稍后再来。' },
};

// 访客页：三种形态——展项列表 / 展项详情 / 短码查询结果。
// 内容来源严格区分：列表与详情只渲染已发布展项；短码结果完全由 rules.resolveCode 决定，
// 任何失败原因都不附带后台内容（包括草稿标题）。
export default function Visitor({ exhibits, initialCode, lookUp, onBack }) {
  const published = exhibits.filter((x) => x.status === '已发布');
  const [detailId, setDetailId] = useState(null);
  const [codeInput, setCodeInput] = useState(initialCode || '');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (initialCode) {
      setCodeInput(initialCode);
      setResult(lookUp(initialCode));
      setDetailId(null);
    }
  }, [initialCode, lookUp]);

  const submitCode = () => {
    const r = lookUp(codeInput);
    setResult(r);
    setDetailId(null);
  };

  const detail = result?.ok ? result.exhibit : published.find((x) => x.id === detailId);

  return (
    <div className="visitor">
      <header>
        <div className="brand"><span className="mark">M</span><span>潮汐美术馆</span></div>
        <div className="visitor-code-bar">
          <input
            aria-label="输入标牌短码"
            placeholder="输入标牌短码，如 K7MP2Q"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCode()}
          />
          <button className="code-go" onClick={submitCode}>前往</button>
        </div>
        <button className="ghost" onClick={onBack}>返回工作台</button>
      </header>

      {result && !result.ok ? (
        <main className="visitor-main code-result">
          <ReasonCard reason={result.reason} onReset={() => { setResult(null); setCodeInput(''); }} />
        </main>
      ) : detail ? (
        <main className="detail">
          <div className="detail-art" style={{ background: detail.color }}>
            <span>{String(detail.id).slice(-2).padStart(2, '0')}</span>
          </div>
          <div className="detail-copy">
            <span className="eyebrow">{detail.room} / {detail.type}</span>
            <h1>{detail.title}</h1>
            <p>{detail.desc}</p>
            {detail.audio && <button className="audio">▶ 播放语音导览</button>}
            <div className="qr">
              <div className="qr-box">▦</div>
              <div>
                <strong>{result?.ok ? `标牌短码 ${result.code}` : '分享这个展项'}</strong>
                <small>{result?.ok ? '本短码仅对当前发布内容有效，撤展后立即失效' : '扫描二维码，在手机上继续阅读'}</small>
              </div>
            </div>
            <div className="detail-back">
              <button className="ghost" onClick={() => { setResult(null); setDetailId(null); }}>← 全部展项</button>
            </div>
          </div>
        </main>
      ) : (
        <main className="visitor-main">
          <span className="eyebrow">VISITOR GUIDE / 2026</span>
          <h1>沿着作品，<em>走进</em>另一种时间。</h1>
          <p className="lead">当你靠近一件作品，它的故事就开始流动。输入标牌短码，或选择一个展项开始探索。</p>
          <div className="visitor-grid">
            {published.map((x) => (
              <article className="visitor-card" key={x.id} onClick={() => { setResult(null); setDetailId(x.id); }}>
                <div className="art" style={{ background: x.color }}>
                  <span>{String(x.id).slice(-2).padStart(2, '0')}</span><i>↗</i>
                </div>
                <div className="card-meta">
                  <small>{x.room}</small>
                  <h3>{x.title}</h3>
                  <p>{x.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}

function ReasonCard({ reason, onReset }) {
  const copy = REASON_TEXT[reason] || REASON_TEXT.NOT_FOUND;
  return (
    <div className="reason-card">
      <div className="reason-mark">!</div>
      <span className="eyebrow">CODE LOOKUP</span>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <button className="secondary" onClick={onReset}>重新输入</button>
    </div>
  );
}
