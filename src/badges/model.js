// 标牌资料层：只定义数据结构、短码字符表与编号原语，不含规则判断与存储。

// 32 个字符，剔除易混的 0/O、1/I，方便现场人工核对
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export const BATCH_STATUS = Object.freeze({
  PENDING: '待启用', // 已打印、尚未发放
  ACTIVE: '有效',   // 已启用，访客可扫
  INVALID: '已失效', // 随撤展作废，历史保留
});

export const INVALID_REASON = Object.freeze({
  WITHDRAWN: '撤展',
});

// 访客输入容错：转大写、去掉空格/连字符等非字母数字字符
export function normalizeCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function randomUint32Array(n) {
  const buf = new Uint32Array(n);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < n; i += 1) buf[i] = Math.floor(Math.random() * 0x100000000);
  }
  return buf;
}

// 生成短码。字符表长度 32，与 2^32 整除，取模无偏。
export function generateCode(length = CODE_LENGTH, alphabet = CODE_ALPHABET) {
  const buf = randomUint32Array(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export function createBatchId() {
  return 'B' + Date.now().toString(36).toUpperCase() + generateCode(4);
}
