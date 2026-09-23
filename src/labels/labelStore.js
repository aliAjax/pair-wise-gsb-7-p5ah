// 保存：批次与标牌的本地持久化。只负责读写，不含资料形状与发放规则。
const STORAGE_KEY = 'guide-labels-v1';

const EMPTY = { batches: [], labels: [] };

export function loadLabels() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Array.isArray(raw.batches) && Array.isArray(raw.labels)) return raw;
  } catch { /* 数据损坏时回退为空 */ }
  return EMPTY;
}

export function saveLabels(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* 存储不可用时静默失败，当前会话数据仍可用 */ }
}
