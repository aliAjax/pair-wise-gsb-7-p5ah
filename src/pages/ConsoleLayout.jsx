import React from 'react';

// 后台框架：侧边导航 + 访客预览入口。具体页面通过 children 注入。
export default function ConsoleLayout({ tab, onTab, onPreview, topbar, children }) {
  return (
    <div className="app">
      <aside>
        <div className="brand"><span className="mark">M</span><span>展览工作台</span></div>
        <div className="side-label">当前项目</div>
        <div className="project">
          <span className="project-dot"></span>
          <div><strong>潮汐之后</strong><small>2026 春季展</small></div>
          <span>⌄</span>
        </div>
        <nav>
          <button className={tab === 'exhibits' ? 'active' : ''} onClick={() => onTab('exhibits')}>
            ▧ <span>展项内容</span>
          </button>
          <button className={tab === 'badges' ? 'active' : ''} onClick={() => onTab('badges')}>
            ◉ <span>二维码标牌</span>
          </button>
        </nav>
        <div className="side-foot">
          <button>⚙ 设置</button>
          <small>已自动保存 · 刚刚</small>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          {topbar}
          <div className="top-actions">
            <button className="secondary" onClick={onPreview}>◉ 访客预览</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
