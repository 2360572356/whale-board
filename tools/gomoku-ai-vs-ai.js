#!/usr/bin/env node
'use strict';

// 五子棋自测 II：两个 AI 互相下。
// gomoku-selfplay 里对手是随机落子，赢它说明不了什么；这里两边都用 gBest。
// gBest 是确定性的，所以开局先随机撒在中心 5×5 里，否则每盘都是同一局。
// 看三件事：会不会下成死循环（超过棋盘格数）、有没有非法落子、先手优势有多大。
// 用法：node tools/gomoku-ai-vs-ai.js [盘数]

const { gNew, gWin, gBest, gLabel } = require('../play.js');

const games = Math.max(1, parseInt(process.argv[2], 10) || 5);
const GN = 15;

function legal(pt, b) {
  return pt && pt[0] >= 0 && pt[1] >= 0 && pt[0] < GN && pt[1] < GN && !b[pt[0]][pt[1]];
}

function openSpot(b) {
  const cells = [];
  for (let r = 5; r <= 9; r++) for (let c = 5; c <= 9; c++) if (!b[r][c]) cells.push([r, c]);
  return cells[Math.floor(Math.random() * cells.length)];
}

let black = 0, white = 0, draw = 0, illegal = 0, totalMoves = 0, longest = 0;
const hist = [];
const t0 = Date.now();

for (let n = 0; n < games; n++) {
  const b = gNew();
  let who = 1, moves = 0, winner = 0;
  while (moves < GN * GN) {
    const pt = moves < 2 ? openSpot(b) : gBest(b, who, 3 - who);
    if (!legal(pt, b)) {
      illegal++;
      console.log(`  第 ${n + 1} 盘，${who === 1 ? '黑' : '白'}方给了个不合法的手：${pt}`);
      break;
    }
    b[pt[0]][pt[1]] = who;
    moves++;
    if (gWin(b, pt[0], pt[1], who)) { winner = who; break; }
    who = 3 - who;
  }
  if (winner === 1) black++;
  else if (winner === 2) white++;
  else draw++;
  totalMoves += moves;
  longest = Math.max(longest, moves);
  hist.push(moves);
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`跑了 ${games} 盘，用时 ${secs}s`);
console.log(`  黑胜 ${black}  白胜 ${white}  和 ${draw}`);
console.log(`  手数：${hist.join(' / ')}`);
console.log(`  平均 ${(totalMoves / games).toFixed(1)} 手，最长 ${longest} 手，非法落子 ${illegal} 次`);
process.exit(illegal ? 1 : 0);
