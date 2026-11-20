#!/usr/bin/env node
'use strict';

// 五子棋的几个基本断言。不为覆盖率，只为占住两件出过事的地方：
// 一是候选里混进已经被占掉的格子，二是该堵的时候不堵。
//
// 用法：node tools/gomoku-check.js

const { gNew, gWin, gScore, gCandidates, gBest } = require('../play.js');

const GN = 15;
let failed = 0;

function check(name, cond, extra) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? `  ${extra}` : ''}`);
  }
}

function put(b, r, c, v) {
  b[r][c] = v;
}

// 1. 空盘：候选里只有天元，而且不重复
{
  const b = gNew();
  const c = gCandidates(b);
  check('空盘候选只有一处', c.length === 1 && c[0][0] === 7 && c[0][1] === 7);
}

// 2. 候选永远不含已占格（这是那个假分数的根，不许再回来）
{
  const b = gNew();
  put(b, 7, 7, 1);
  put(b, 7, 8, 2);
  put(b, 8, 8, 1);
  const bad = gCandidates(b).filter(([r, c]) => b[r][c] !== 0);
  check('候选里没有已占格', bad.length === 0, bad.length ? `混进 ${bad.length} 个` : '');
}

// 3. 对面活四，必须堵
{
  const b = gNew();
  for (let c = 4; c <= 7; c++) put(b, 7, c, 2); // 白 7,4 - 7,7 四连，两头空
  put(b, 0, 0, 1);
  const pt = gBest(b, 1, 2);
  const blocks = pt && pt[0] === 7 && (pt[1] === 3 || pt[1] === 8);
  check('对面活四会去堵', blocks, pt ? `下了 ${pt}` : '没下');
}

// 4. 自己能连五，直接连，别管对面
{
  const b = gNew();
  for (let c = 4; c <= 7; c++) put(b, 7, c, 1); // 黑自己四连
  for (let c = 4; c <= 7; c++) put(b, 9, c, 2); // 白也四连，但黑先动手
  const pt = gBest(b, 1, 2);
  const wins = pt && pt[0] === 7 && (pt[1] === 3 || pt[1] === 8);
  check('能连五就先连五', wins, pt ? `下了 ${pt}` : '没下');
}

// 5. 落子之后不污染棋盘（gScore 会临时改写格子，必须还原）
{
  const b = gNew();
  put(b, 7, 7, 1);
  put(b, 7, 8, 2);
  const before = JSON.stringify(b);
  gScore(b, 5, 5, 1);
  gCandidates(b);
  check('评分不改棋盘', JSON.stringify(b) === before);
}

// 6. 落下的那一步得是空位，而且是能走的
{
  const b = gNew();
  put(b, 7, 7, 1);
  put(b, 7, 8, 2);
  put(b, 6, 6, 1);
  const pt = gBest(b, 2, 1);
  check('下的那步是空位', pt && b[pt[0]][pt[1]] === 0, pt ? `下了 ${pt}` : '没下');
}

// 7. 连五判定：五连算赢，四连不算
{
  const b = gNew();
  for (let c = 3; c <= 6; c++) put(b, 5, c, 1);
  check('四连不算赢', gWin(b, 5, 6, 1) === false);
  put(b, 5, 7, 1);
  check('五连算赢', gWin(b, 5, 7, 1) === true);
}

console.log(failed ? `\n${failed} 项没过` : '\n全过');
process.exit(failed ? 1 : 0);
