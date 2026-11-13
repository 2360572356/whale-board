#!/usr/bin/env node
'use strict';

// 没有终端、只在聊天里下棋的时候用这个：把落子序列喂给 play.js，回放整盘，只打印最后一步之后的棋盘。
//   node tools/gomoku-replay.js H8 G9 J8
// 黑子 = 玩家（你喂的坐标），白子 = AI。
// 输出压成每行 15 个符号，是为了塞进有字数上限的地方（比如 QQ 单条 500 字）。

const { execFileSync } = require('child_process');
const path = require('path');

const GAME = path.join(__dirname, '..', 'play.js');
const moves = process.argv.slice(2).filter(Boolean);
if (!moves.length) {
  console.error('至少给一手棋，比如：node tools/gomoku-replay.js H8');
  process.exit(1);
}

const input = ['1', ...moves, 'q', ''].join('\n');
const out = execFileSync(process.execPath, [GAME], { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const lines = out.split('\n');

// 每次落子都会重画一遍，取最后一段棋盘（表头 + 15 行）
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^ {3}[A-O] [A-O] /.test(lines[i])) start = i;
}
if (start < 0) {
  console.error('没解析出棋盘，检查坐标格式（A1 ~ O15）');
  process.exit(1);
}

const rows = [];
for (let r = 0; r < 15; r++) {
  const cells = (lines[start + 1 + r] || '').trim().split(/\s+/).slice(1);
  const sym = cells.map((c) => (c === '●' ? '●' : c === '○' ? '○' : '·')).join('');
  rows.push(String(r + 1).padStart(2, ' ') + sym);
}

const verdict = lines.filter((l) => /五子连珠|你赢了|我赢了|平手/.test(l));
const aiLast = lines.filter((l) => /^我\(○\)/.test(l)).map((l) => l.replace('我(○)：', '').trim()).pop();

console.log([...verdict, '  ABCDEFGHIJKLMNO', ...rows, aiLast ? 'AI 最后一手：' + aiLast : ''].filter(Boolean).join('\n'));
