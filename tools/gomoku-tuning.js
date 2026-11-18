#!/usr/bin/env node
'use strict';

// 五子棋调参：让两套权重不同的 AI 对打，看哪套更能成局。
// 起因是 gomoku-ai-vs-ai 里的现象——两边都只会堵，最后把棋盘下满也没人赢。
// 原版 gBest 的评分是 own - opp * 1.05，几乎只在意对面下一步能咬哪儿；
// 这里把进攻/防守的权重拆出来，试几组。
// 用法：node tools/gomoku-tuning.js [每组盘数]

const { gNew, gWin, gScore, gCandidates } = require('../play.js');

const GN = 15;
const GDIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function topScore(b, who) {
  let best = -1;
  for (const [r, c] of gCandidates(b)) {
    const s = gScore(b, r, c, who);
    if (s > best) best = s;
  }
  return best;
}

// 与 gBest 同构，只是把 1.05 那个防守系数和进攻权重拆成参数
function bestV(b, ai, human, wOff, wDef) {
  const cands = gCandidates(b);
  for (const [r, c] of cands) if (gScore(b, r, c, ai) >= 1000000) return [r, c];
  for (const [r, c] of cands) if (gScore(b, r, c, human) >= 1000000) return [r, c];
  let pick = cands[0];
  let pickV = -Infinity;
  for (const [r, c] of cands) {
    const own = gScore(b, r, c, ai);
    b[r][c] = ai;
    const opp = topScore(b, human);
    b[r][c] = 0;
    let v = own * wOff - (opp >= 1000000 ? 8000000 : opp * wDef);
    if (own >= 100000) v += own * 4;
    if (v > pickV) { pickV = v; pick = [r, c]; }
  }
  return pick;
}

function legal(pt, b) {
  return pt && pt[0] >= 0 && pt[1] >= 0 && pt[0] < GN && pt[1] < GN && !b[pt[0]][pt[1]];
}

function openSpot(b) {
  const cells = [];
  for (let r = 5; r <= 9; r++) for (let c = 5; c <= 9; c++) if (!b[r][c]) cells.push([r, c]);
  return cells[Math.floor(Math.random() * cells.length)];
}

// A = 原版权重，B = 候选权重；统计 B 的胜率和和棋率、平均手数
function match(wB, games) {
  let bw = 0, aw = 0, dr = 0, moves = 0, illegal = 0, shut = 0;
  for (let n = 0; n < games; n++) {
    const b = gNew();
    let who = 1, m = 0, winner = 0;
    while (m < GN * GN) {
      let pt;
      if (m < 2) pt = openSpot(b);
      else pt = who === 1 ? bestV(b, 1, 2, 1, 1.05) : bestV(b, 2, 1, wB[0], wB[1]);
      if (!legal(pt, b)) { illegal++; break; }
      b[pt[0]][pt[1]] = who;
      m++;
      if (gWin(b, pt[0], pt[1], who)) { winner = who; break; }
      who = 3 - who;
    }
    if (winner === 1) aw++;
    else if (winner === 2) bw++;
    else { dr++; shut++; }
    moves += m;
  }
  return { bw, aw, dr, shut, avg: moves / games, illegal };
}

const games = Math.max(1, parseInt(process.argv[2], 10) || 20);
const combos = [[1, 1.05], [1.3, 0.9], [1.6, 0.7], [2, 0.6], [1, 0.5]];

console.log(`每组 ${games} 盘。A = 原版(1, 1.05)，B = 候选。`);
for (const w of combos) {
  const r = match(w, games);
  const tag = w[0] === 1 && w[1] === 1.05 ? ' （对照组）' : '';
  console.log(`  进攻 ${w[0]} 防守 ${w[1]}${tag}：B 胜 ${r.bw}  A 胜 ${r.aw}  和 ${r.dr}  平均 ${r.avg.toFixed(1)} 手${r.illegal ? `  非法 ${r.illegal}` : ''}`);
}
