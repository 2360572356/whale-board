#!/usr/bin/env node
'use strict';

// 五子棋自测：AI 执白，对手随机落子，跑若干盘。
// 看三件事：AI 落子合法（空位、不越界）、每盘能收尾、AI 不会输得太难看。
// 用法：node tools/gomoku-selfplay.js [盘数]

const { gNew, gWin, gBest, gLabel } = require('../play.js');

const games = Math.max(1, parseInt(process.argv[2], 10) || 50);
const GN = 15;

function emptyCells(b) {
  const out = [];
  for (let r = 0; r < GN; r++) for (let c = 0; c < GN; c++) if (!b[r][c]) out.push([r, c]);
  return out;
}

let aiWin = 0, humanWin = 0, draw = 0, illegal = 0, maxMoves = 0;
const t0 = Date.now();

for (let n = 0; n < games; n++) {
  const b = gNew();
  let who = 1, moves = 0, winner = 0;
  while (moves < GN * GN) {
    let pt;
    if (who === 2) {
      pt = gBest(b, 2, 1);
      if (!pt || pt[0] < 0 || pt[1] < 0 || pt[0] >= GN || pt[1] >= GN || b[pt[0]][pt[1]]) {
        illegal++;
        console.log(`  第 ${n + 1} 盘 AI 给了个不合法的手：${pt}`);
        break;
      }
    } else {
      const cells = emptyCells(b);
      pt = cells[Math.floor(Math.random() * cells.length)];
    }
    b[pt[0]][pt[1]] = who;
    moves++;
    if (gWin(b, pt[0], pt[1], who)) { winner = who; break; }
    who = 3 - who;
  }
  if (winner === 2) aiWin++;
  else if (winner === 1) humanWin++;
  else draw++;
  maxMoves = Math.max(maxMoves, moves);
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`跑了 ${games} 盘，用时 ${secs}s`);
console.log(`  AI 赢 ${aiWin}  随机赢 ${humanWin}  和 ${draw}`);
console.log(`  最长一盘 ${maxMoves} 手，非法落子 ${illegal} 次`);
process.exit(illegal ? 1 : 0);
