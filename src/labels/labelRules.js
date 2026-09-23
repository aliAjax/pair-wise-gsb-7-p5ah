// 发放规则：批次生成、撤展作废与访客短码核对。只依赖标牌资料，不碰保存与页面。
import {
  CODE_ALPHABET, CODE_LENGTH, BATCH_STATUS,
  normalizeCode, makeBatch, makeLabel,
} from './labelData';

export const MAX_BATCH_SIZE = 100;

function makeId() {
  return `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function randomCode() {
  const buf = new Uint32Array(CODE_LENGTH);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return code;
}

// 为「已发布」展项生成一批标牌。短码与全部历史短码比对：
// 既保证同一短码不会出现在两批有效标牌里，也保证撤展后的旧码不再复用、不能再扫。
export function issueBatch(data, exhibit, { hall, printedBy, count }) {
  if (!exhibit || exhibit.status !== '已发布') {
    return { ok: false, error: '只能为已发布的展项生成标牌' };
  }
  const cleanHall = String(hall ?? '').trim();
  const cleanPrinter = String(printedBy ?? '').trim();
  const size = Math.floor(Number(count));
  if (!cleanHall) return { ok: false, error: '请填写展厅' };
  if (!cleanPrinter) return { ok: false, error: '请填写打印人' };
  if (!Number.isFinite(size) || size < 1 || size > MAX_BATCH_SIZE) {
    return { ok: false, error: `每批数量需在 1–${MAX_BATCH_SIZE} 之间` };
  }
  const createdAt = new Date().toISOString();
  const batch = makeBatch({ id: makeId(), exhibitId: exhibit.id, createdAt });
  const used = new Set(data.labels.map((l) => l.code));
  const labels = [];
  while (labels.length < size) {
    const code = randomCode();
    if (used.has(code)) continue;
    used.add(code);
    labels.push(makeLabel({ code, hall: cleanHall, printedBy: cleanPrinter, batchId: batch.id, exhibitId: exhibit.id, createdAt }));
  }
  return {
    ok: true,
    batch,
    labels,
    data: { batches: [...data.batches, batch], labels: [...data.labels, ...labels] },
  };
}

// 撤展：该展项所有有效批次立即失效；批次与标牌记录全部保留备查。
export function revokeBatchesForExhibit(data, exhibitId, revokedAt = new Date().toISOString()) {
  let changed = false;
  const batches = data.batches.map((b) => {
    if (b.exhibitId !== exhibitId || b.status !== BATCH_STATUS.ACTIVE) return b;
    changed = true;
    return { ...b, status: BATCH_STATUS.REVOKED, revokedAt };
  });
  return changed ? { ...data, batches } : data;
}

// 访客核对短码。失败时只返回原因文案，绝不携带展项内容，避免带出后台草稿。
export function resolveCode(data, exhibits, input) {
  const code = normalizeCode(input);
  if (!code) return { ok: false, reason: 'empty', message: '请输入标牌上的短码' };
  const label = data.labels.find((l) => l.code === code);
  if (!label) return { ok: false, reason: 'unknown', message: '没有这个短码，请核对标牌后重试' };
  const batch = data.batches.find((b) => b.id === label.batchId);
  if (!batch || batch.status !== BATCH_STATUS.ACTIVE) {
    return { ok: false, reason: 'revoked', message: '该展项已撤展，此标牌已失效' };
  }
  const exhibit = exhibits.find((x) => x.id === label.exhibitId);
  if (!exhibit || exhibit.status !== '已发布') {
    return { ok: false, reason: 'not-live', message: '展项尚未启用，请稍后再试' };
  }
  return { ok: true, exhibit };
}
