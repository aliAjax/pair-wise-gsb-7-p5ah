// 展项与标牌的初始资料。标牌种子与规则约束保持一致：
// - 展项1（已发布）有一批“有效”标牌，可现场核对试扫；
// - 展项3（已发布）有一批“待启用”，演示“尚未启用只说原因”；
// - 展项2 是草稿，无任何标牌，演示“错码不带出草稿”。

export const seedExhibits = [
  { id: 1, title: '潮汐之后', room: 'A01 · 主展厅', type: '装置', desc: '一件记录海岸线变化的沉浸式影像装置。', audio: 'https://example.com/audio.mp3', status: '已发布', color: '#e6b45d' },
  { id: 2, title: '未寄出的信', room: 'B02 · 纸上时间', type: '档案', desc: '来自三代人的手写信件与声音档案。', audio: '', status: '草稿', color: '#ef8f84' },
  { id: 3, title: '柔软的边界', room: 'C01 · 新媒介', type: '互动', desc: '观众的移动会改变墙面上的光影。', audio: '', status: '已发布', color: '#83b9b1' },
];

const T0 = Date.UTC(2026, 8, 10, 2, 0, 0);

export const seedBatches = [
  {
    id: 'BSEED0001',
    exhibitId: 1,
    room: 'A01 · 主展厅',
    printer: '林晓',
    createdAt: T0,
    enabledAt: T0 + 3600_000,
    status: '有效',
    invalidReason: '',
    invalidAt: null,
    codes: ['K7MP2Q', 'TR4F9X'],
  },
  {
    id: 'BSEED0002',
    exhibitId: 3,
    room: 'C01 · 新媒介',
    printer: '林晓',
    createdAt: T0 + 86400_000,
    enabledAt: null,
    status: '待启用',
    invalidReason: '',
    invalidAt: null,
    codes: ['NW6JHD', 'P8QKRM'],
  },
];
