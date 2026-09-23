import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadBadgeState, loadExhibits, saveBadgeState, saveExhibits } from './data/storage.js';
import {
  enableBatch,
  invalidateBatch,
  invalidateBatchesForExhibit,
  issueBatch,
  resolveCode,
  withdrawExhibit,
} from './badges/rules.js';
import ConsoleLayout from './pages/ConsoleLayout.jsx';
import ExhibitsPage from './pages/ExhibitsPage.jsx';
import BadgesPage from './pages/BadgesPage.jsx';
import Visitor from './pages/Visitor.jsx';

const parseHash = () => {
  const h = window.location.hash.replace(/^#/, '');
  const m = h.match(/^\/g\/([A-Za-z0-9\- ]+)/);
  if (m) return { view: 'visitor', code: m[1] };
  if (h === '/visitor') return { view: 'visitor', code: '' };
  return { view: 'console', code: '' };
};

function App() {
  const [exhibits, setExhibits] = useState(loadExhibits);
  const [badgeState, setBadgeState] = useState(loadBadgeState);
  const [tab, setTab] = useState('exhibits');
  const [selectedId, setSelectedId] = useState(() => loadExhibits()[0]?.id ?? 1);
  const [route, setRoute] = useState(parseHash);
  const [notice, setNotice] = useState('');

  useEffect(() => saveExhibits(exhibits), [exhibits]);
  useEffect(() => saveBadgeState(badgeState), [badgeState]);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const state = useMemo(() => ({ exhibits, batches: badgeState.batches }), [exhibits, badgeState]);

  const updateExhibit = (id, patch) =>
    setExhibits((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addExhibit = (item) => {
    setExhibits((list) => [...list, item]);
    setSelectedId(item.id);
  };

  // 撤展：展项标记 + 全部关联批次立即失效，一次提交
  const handleWithdraw = useCallback(
    (id) => {
      const next = withdrawExhibit(state, id);
      setExhibits(next.exhibits);
      setBadgeState({ ...badgeState, batches: next.batches });
    },
    [state, badgeState],
  );

  // 撤回发布（退回草稿）：非撤展；有效批次同步失效，避免再扫到草稿
  const handleUnpublish = useCallback(
    (id) => {
      setExhibits((list) => list.map((x) => (x.id === id ? { ...x, status: '草稿' } : x)));
      setBadgeState((s) => invalidateBatchesForExhibit(s, id, '内容撤回发布'));
    },
    [],
  );

  const runBadgeAction = useCallback(
    (fn, okMsg) => {
      try {
        const next = fn();
        setBadgeState(next);
        if (okMsg) setNotice(okMsg);
        return true;
      } catch (e) {
        setNotice(e.message || '操作失败');
        return false;
      }
    },
    [setBadgeState],
  );

  const handleIssue = useCallback(
    (exhibitId, input) => {
      const exhibit = exhibits.find((x) => x.id === exhibitId);
      try {
        const next = issueBatch(badgeState, exhibit, input);
        setBadgeState(next);
        setNotice(`已生成 ${input.count} 枚标牌，批次待启用`);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: e.message };
      }
    },
    [exhibits, badgeState],
  );

  const handleEnable = (id) =>
    runBadgeAction(() => enableBatch(badgeState, id), '批次已启用，标牌可以扫描');
  const handleInvalidate = (id) =>
    runBadgeAction(() => invalidateBatch(badgeState, id, '人工作废'), '批次已作废并留档');

  const lookUp = useCallback((raw) => resolveCode(state, raw), [state]);

  if (route.view === 'visitor') {
    return (
      <Visitor
        exhibits={exhibits}
        initialCode={route.code}
        lookUp={lookUp}
        onBack={() => { window.location.hash = ''; }}
      />
    );
  }

  return (
    <>
      <ConsoleLayout
        tab={tab}
        onTab={setTab}
        onPreview={() => { window.location.hash = '/visitor'; }}
        topbar={
          tab === 'exhibits'
            ? <div><span className="eyebrow">EXHIBITION BUILDER</span><h1>展项内容</h1></div>
            : <div><span className="eyebrow">QR BADGES</span><h1>二维码标牌</h1></div>
        }
      >
        {tab === 'exhibits' ? (
          <ExhibitsPage
            exhibits={exhibits}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updateExhibit}
            onAdd={addExhibit}
            onWithdraw={handleWithdraw}
            onUnpublish={handleUnpublish}
            onNotice={setNotice}
          />
        ) : (
          <BadgesPage
            exhibits={exhibits}
            batches={badgeState.batches}
            onIssue={handleIssue}
            onEnable={handleEnable}
            onInvalidate={handleInvalidate}
            onWithdraw={handleWithdraw}
            onNotice={setNotice}
          />
        )}
      </ConsoleLayout>
      {notice && <div className="toast">{notice}</div>}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
