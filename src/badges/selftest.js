// 规则层冒烟测试（node src/badges/selftest.js），无任何依赖。
import assert from 'node:assert';
import { seedBatches, seedExhibits } from '../data/seed.js';
import { BATCH_STATUS } from './model.js';
import {
  enableBatch, findActiveCodeOwner, invalidateBatch, issueBatch, resolveCode, withdrawExhibit,
} from './rules.js';

let state = { exhibits: seedExhibits, batches: seedBatches };
const T = 1_900_000_000_000;
let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log('  ✓', name); };

// 1. 种子有效码可解析到已发布内容
ok('有效短码打开当前发布内容', () => {
  const r = resolveCode(state, 'k7mp2q', T); // 小写、容错
  assert.equal(r.ok, true);
  assert.equal(r.exhibit.title, '潮汐之后');
});

// 2. 待启用批次只报“尚未启用”，不带内容
ok('待启用批次报 NOT_ENABLED', () => {
  const r = resolveCode(state, 'NW6JHD', T);
  assert.deepEqual(r, { ok: false, reason: 'NOT_ENABLED' });
});

// 3. 错码
ok('错码报 NOT_FOUND', () => {
  assert.equal(resolveCode(state, 'ZZZZZZ', T).reason, 'NOT_FOUND');
  assert.equal(resolveCode(state, '', T).reason, 'NOT_FOUND');
});

// 4. 草稿展项无码；不能给草稿/撤展发码
ok('草稿展项不能生成批次', () => {
  assert.throws(() => issueBatch(state, seedExhibits[1], { count: 3, printer: '甲' }), /已发布/);
});
ok('缺少打印人 / 数量非法被拒', () => {
  assert.throws(() => issueBatch(state, seedExhibits[0], { count: 2, printer: '  ' }));
  assert.throws(() => issueBatch(state, seedExhibits[0], { count: 0, printer: '甲' }));
  assert.throws(() => issueBatch(state, seedExhibits[0], { count: 501, printer: '甲' }));
});

// 5. 新批次待启用；启用后与其他有效批次撞码被拒
let pendingId;
ok('新批次为待启用，启用时撞码被拒', () => {
  const next = issueBatch(state, seedExhibits[0], { count: 2, printer: '甲', room: 'A01' }, T);
  const batch = next.batches[0];
  pendingId = batch.id;
  assert.equal(batch.status, BATCH_STATUS.PENDING);
  // 强行塞入与有效批次相同的码，启用必须失败且原状态不变
  const tampered = { ...next, batches: next.batches.map((b) => (b.id === batch.id ? { ...b, codes: ['K7MP2Q', b.codes[1]] } : b)) };
  assert.throws(() => enableBatch(tampered, batch.id, T), /占用/);
  state = next;
});
ok('正常启用成功', () => {
  state = enableBatch(state, pendingId, T);
  assert.equal(state.batches[0].status, BATCH_STATUS.ACTIVE);
  assert.equal(findActiveCodeOwner(state, state.batches[0].codes[0])?.id, pendingId);
});

// 6. 撤展：内容下线、全部关联批次立即失效；旧码报 WITHDRAWN
ok('撤展后旧码立即报 WITHDRAWN，历史保留', () => {
  const before = state.batches.filter((b) => b.exhibitId === 1).length;
  state = withdrawExhibit(state, 1, T + 1000);
  assert.equal(state.exhibits.find((x) => x.id === 1).status, '已撤展');
  const related = state.batches.filter((b) => b.exhibitId === 1);
  assert.equal(related.length, before); // 历史不删
  assert.ok(related.every((b) => b.status === BATCH_STATUS.INVALID));
  assert.equal(resolveCode(state, 'K7MP2Q', T).reason, 'WITHDRAWN');
});

// 7. 重新布展：重新发布 + 新批次，旧码仍不能扫，新码可扫
ok('重新布展：旧码作废、新码可扫', () => {
  state = { ...state, exhibits: state.exhibits.map((x) => (x.id === 1 ? { ...x, status: '已发布' } : x)) };
  // 旧码依旧 WITHDRAWN，即便内容重新发布
  assert.equal(resolveCode(state, 'K7MP2Q', T).reason, 'WITHDRAWN');
  const next = issueBatch(state, state.exhibits[0], { count: 1, printer: '乙' }, T + 2000);
  const nb = next.batches[0];
  state = enableBatch(next, nb.id, T + 3000);
  const r = resolveCode(state, nb.codes[0], T + 4000);
  assert.equal(r.ok, true);
  assert.equal(r.exhibit.status, undefined); // 公开投影不含后台状态字段
});

// 8. 人工作废
ok('人工作废后报 REVOKED', () => {
  const active = state.batches.find((b) => b.status === BATCH_STATUS.ACTIVE);
  const s2 = invalidateBatch(state, active.id, '人工作废', T + 5000);
  assert.equal(resolveCode(s2, active.codes[0], T).reason, 'REVOKED');
  assert.throws(() => invalidateBatch(s2, active.id), /有效批次/);
});

// 9. 有效批次存在时，展项退回草稿，扫描绝不带草稿
ok('展项退回草稿后扫描不带出草稿', () => {
  const s = {
    exhibits: seedExhibits,
    batches: seedBatches, // 展项1的有效批次
  };
  const drafted = { ...s, exhibits: s.exhibits.map((x) => (x.id === 1 ? { ...x, status: '草稿' } : x)) };
  const r = resolveCode(drafted, 'K7MP2Q', T);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'NOT_PUBLISHED');
  assert.ok(!('exhibit' in r));
});

console.log(`\n全部 ${passed} 项通过`);
