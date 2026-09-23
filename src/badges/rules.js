// 发放规则层：纯函数。只依赖资料层，不知道 localStorage、也不知道 React。
//
// 核心约束：
// 1. 同一短码不能出现在两批“有效”标牌里（待启用批次不冲突，作废批次不冲突）；
// 2. 标牌只能为已发布展项生成；批次先打印（待启用），启用后才可扫；
// 3. 展项撤展时其全部有效批次立即失效，历史永久保留；
// 4. 撤展后重新布展是一次新的发布，必须新建批次，旧码不能再扫；
// 5. 访客只能看到“当前已发布”的内容；错码/撤展/未启用只返回原因。

import { BATCH_STATUS, createBatchId, generateCode, normalizeCode } from './model.js';

export const ISSUE = Object.freeze({
  CODE_TAKEN: '短码已被其他有效批次占用',
  EXHIBIT_NOT_PUBLISHED: '只能为已发布展项生成标牌',
  BAD_COUNT: '每批标牌数量需在 1–500 之间',
  BAD_PRINTER: '请填写打印人',
  BATCH_NOT_PENDING: '只有待启用的批次可以启用',
  BATCH_NOT_ACTIVE: '只有有效批次可以作废',
  EXHIBIT_MISSING: '展项不存在',
});

const EXHIBIT_PUBLISHED = '已发布';
const EXHIBIT_WITHDRAWN = '已撤展';

export function isPublished(exhibit) {
  return !!exhibit && exhibit.status === EXHIBIT_PUBLISHED;
}

function fail(code) {
  const err = new Error(ISSUE[code] ?? code);
  err.code = code;
  return err;
}

const activeBatches = (state) => state.batches.filter((b) => b.status === BATCH_STATUS.ACTIVE);

// 短码是否已被“有效”批次占用（本批次自身除外）
export function findActiveCodeOwner(state, code, selfBatchId = null) {
  for (const batch of activeBatches(state)) {
    if (batch.id === selfBatchId) continue;
    if (batch.codes.some((c) => c === code)) return batch;
  }
  return null;
}

// 生成直到拿到不与有效批次冲突的短码；全局兜底再扫一遍所有历史码，保证永不复用旧码。
function mintCode(state, used) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = generateCode();
    if (used.has(code)) continue;
    if (findActiveCodeOwner(state, code)) continue;
    return code;
  }
  throw fail('CODE_TAKEN');
}

// 发放前预检，UI 可先调用给出提示
export function assertCanIssue(state, exhibit, input) {
  if (!isPublished(exhibit)) throw fail('EXHIBIT_NOT_PUBLISHED');
  if (!input.printer || !String(input.printer).trim()) throw fail('BAD_PRINTER');
  const count = Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw fail('BAD_COUNT');
}

// 新建批次：初始为“待启用”（已打印、尚未发放，访客此时扫不到）
export function issueBatch(state, exhibit, input, now = Date.now()) {
  assertCanIssue(state, exhibit, input);
  const used = new Set();
  state.batches.forEach((b) => b.codes.forEach((c) => used.add(c)));
  const count = Number(input.count);
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const code = mintCode(state, used);
    used.add(code);
    codes.push(code);
  }
  const batch = {
    id: createBatchId(),
    exhibitId: exhibit.id,
    room: (input.room || exhibit.room || '').trim(),
    printer: String(input.printer).trim(),
    createdAt: now,
    status: BATCH_STATUS.PENDING,
    invalidReason: '',
    invalidAt: null,
    enabledAt: null,
    codes,
  };
  return { ...state, batches: [batch, ...state.batches] };
}

// 启用批次：逐码核对不得与其他有效批次撞码
export function enableBatch(state, batchId, now = Date.now()) {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || batch.status !== BATCH_STATUS.PENDING) throw fail('BATCH_NOT_PENDING');
  for (const code of batch.codes) {
    if (findActiveCodeOwner(state, code, batchId)) throw fail('CODE_TAKEN');
  }
  return {
    ...state,
    batches: state.batches.map((b) =>
      b.id === batchId ? { ...b, status: BATCH_STATUS.ACTIVE, enabledAt: now } : b,
    ),
  };
}

function invalidateOne(batch, now, reason) {
  return { ...batch, status: BATCH_STATUS.INVALID, invalidReason: reason, invalidAt: now };
}

// 手工作废（补录/损坏等）；撤展走 invalidateBatchesForExhibit
export function invalidateBatch(state, batchId, reason, now = Date.now()) {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || batch.status !== BATCH_STATUS.ACTIVE) throw fail('BATCH_NOT_ACTIVE');
  return {
    ...state,
    batches: state.batches.map((b) =>
      b.id === batchId ? invalidateOne(b, now, reason || '人工作废') : b,
    ),
  };
}

// 撤展：该展项所有“有效”批次立即失效；待启用批次一并作废（展项已不可导览）。历史不动。
export function invalidateBatchesForExhibit(state, exhibitId, reason, now = Date.now()) {
  return {
    ...state,
    batches: state.batches.map((b) =>
      b.exhibitId === exhibitId && b.status !== BATCH_STATUS.INVALID
        ? invalidateOne(b, now, reason)
        : b,
    ),
  };
}

// 撤展动作：展项标记为已撤展 + 其批次同步失效，一个原子结果
export function withdrawExhibit(state, exhibitId, now = Date.now()) {
  const exhibit = state.exhibits.find((x) => x.id === exhibitId);
  if (!exhibit) throw fail('EXHIBIT_MISSING');
  const exhibits = state.exhibits.map((x) =>
    x.id === exhibitId ? { ...x, status: EXHIBIT_WITHDRAWN } : x,
  );
  const next = invalidateBatchesForExhibit(
    { ...state, exhibits },
    exhibitId,
    '随展项撤展作废',
    now,
  );
  return { exhibits: next.exhibits, batches: next.batches };
}

// 访客解析短码：返回 {ok:true, exhibit（仅已发布字段）} 或 {ok:false, reason}
// reason 用稳定的机器码，页面层再决定文案——草稿内容绝不出现在任何分支里。
export function resolveCode(state, rawInput, now = Date.now()) {
  const code = normalizeCode(rawInput);
  if (!code) return { ok: false, reason: 'NOT_FOUND' };

  let hit = null;
  for (const batch of state.batches) {
    if (batch.codes.includes(code)) {
      if (!hit || batch.createdAt > hit.batch.createdAt) hit = { batch };
    }
  }
  if (!hit) return { ok: false, reason: 'NOT_FOUND' };

  const { batch } = hit;
  const exhibit = state.exhibits.find((x) => x.id === batch.exhibitId);

  // 展项已撤展（或已删除）：优先报撤展，即使命中的是待启用批次
  if (!exhibit || exhibit.status === EXHIBIT_WITHDRAWN) return { ok: false, reason: 'WITHDRAWN' };
  if (batch.status === BATCH_STATUS.PENDING) return { ok: false, reason: 'NOT_ENABLED' };
  if (batch.status === BATCH_STATUS.INVALID) {
    // 撤展作废的批次即使后来重新布展，文案只陈述“旧标牌已随撤展作废”这一事实
    return batch.invalidReason === '随展项撤展作废'
      ? { ok: false, reason: 'WITHDRAWN' }
      : { ok: false, reason: 'REVOKED' };
  }
  // 双保险：批次有效但展项已退回草稿等非发布态，一律不放出内容
  if (exhibit.status !== EXHIBIT_PUBLISHED) return { ok: false, reason: 'NOT_PUBLISHED' };
  return {
    ok: true,
    code,
    exhibit: {
      id: exhibit.id,
      title: exhibit.title,
      room: exhibit.room,
      type: exhibit.type,
      desc: exhibit.desc,
      audio: exhibit.audio,
      color: exhibit.color,
    },
    batch: { id: batch.id, room: batch.room },
    resolvedAt: now,
  };
}
