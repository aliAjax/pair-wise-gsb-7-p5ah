// 保存层：只负责 localStorage 的读写与数据整形，规则一律放在 badges/rules.js。
// 展项内容与标牌批次分两个 key 保存，互不影响。

import { seedBatches, seedExhibits } from '../data/seed.js';

const EXHIBITS_KEY = 'guide-exhibits';
const BADGES_KEY = 'guide-badge-batches';
const BADGE_VERSION = 1;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// 兼容旧版本只存了展项数组的情况，并补全撤展状态
export function loadExhibits() {
  const data = readJSON(EXHIBITS_KEY, seedExhibits);
  const list = Array.isArray(data) ? data : data.exhibits || seedExhibits;
  return list.map((x) => ({
    ...x,
    status: x.status === '已撤展' ? '已撤展' : x.status === '已发布' ? '已发布' : '草稿',
  }));
}

export function saveExhibits(exhibits) {
  localStorage.setItem(EXHIBITS_KEY, JSON.stringify(exhibits));
}

export function loadBadgeState() {
  const data = readJSON(BADGES_KEY, null);
  if (data && Array.isArray(data.batches)) {
    return { version: data.version ?? BADGE_VERSION, batches: data.batches };
  }
  return { version: BADGE_VERSION, batches: seedBatches };
}

export function saveBadgeState(state) {
  localStorage.setItem(
    BADGES_KEY,
    JSON.stringify({ version: BADGE_VERSION, batches: state.batches }),
  );
}
