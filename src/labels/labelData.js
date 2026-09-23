// 标牌资料：短码、批次与标牌的数据形状。不依赖其他模块。

// 字符集去掉 0/O、1/I/L 等易混淆字符，方便访客对照实体标牌输入。
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export const BATCH_STATUS = { ACTIVE: 'active', REVOKED: 'revoked' };

// 访客输入统一成大写、去掉空格和连字符后再核对。
export function normalizeCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// 展示时按 3-3 分组，便于肉眼核对；存储与比对始终用原始短码。
export function formatCode(code) {
  const c = normalizeCode(code);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

export function makeBatch({ id, exhibitId, createdAt }) {
  return { id, exhibitId, createdAt, revokedAt: null, status: BATCH_STATUS.ACTIVE };
}

// 每张标牌保存：短码、展厅、打印人，并归属某个批次与展项。
export function makeLabel({ code, hall, printedBy, batchId, exhibitId, createdAt }) {
  return { code, hall, printedBy, batchId, exhibitId, createdAt };
}
