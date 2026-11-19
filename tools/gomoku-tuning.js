#!/usr/bin/env node
'use strict';

// 五子棋调参：让两套权重不同的 AI 对打，看哪套更能成局。
// 起因是 gomoku-ai-vs-ai 里的现象——两边都只会堵，最后把棋盘下满也没人赢。
// 原版 gBest 的评分是 own - opp * 1.05，几乎只在意对面下一步能咬哪儿；
// 这里把进攻/防守的权重拆出来，试几组。
//
// 速度：原版对每个候选都要算一遍对手的最好一手，棋盘一满就是几百次评估，
// 一盘要好几秒。这里先粗筛到前 TOPN 再细算。
// 粗筛必须同时看攻和守——只按己方分排会把对手的四三挤出候选，等于瞎。
// 用法：node tools/gomoku-tuning.js [每组盘数]

const { gNew, gWin, gScore, gCandidates } = require('../play.js');

const GN = 15;
const TOPN = 14;

// 只数空位里的最好一手：落下之后原来那格已经占了，不能再冒充对手的地盘
function topScore(b, who, cands) {
  let best = -1;
  for (const [r, c] of cands) {
    if (b[r][c] !== 0) continue;
    const s = gScore(b, r, c, who);
    if (s > best) best = s;
  }
  return best;
}

// 与 gBest 同构，只是把进攻/防守的权重拆成参数
function bestV(b, ai, human, wOff, wDef) {
  const cands = gCandidates(b);
  for (const [r, c] of cands) if (gScore(b, r, c, ai) >= 1000000) return [r, c];
  for (const [r, c] of cands) if (gScore(b, r, c, human) >= 1000000) return [r, c];

  const ranked = cands
    .map((pt) => {
      const own = gScore(b, pt[0], pt[1], ai);
      const def = gScore(b, pt[0], pt[1], human);
      return [pt, own, def, own + def];
    })
    .sort((x, y) => y[3] - x[3]);
  const top = ranked.slice(0, TOPN);

  let pick = top[0][0];
  let pickV = -Infinity;
  for (const [[r, c], own] of top) {
    b[r][c] = ai;
    const opp = topScore(b, human, cands);
    b[r][c] = 0;
    let v = own * wOff - (opp >= 1000000 ? 8000000 : opp * wDef);
    if (own >= 100000) v += 400000;
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

// 黑白轮流执候选权重：先手本身值半盘棋，不换边比不出东西
function match(wB, games) {
  let bw = 0, aw = 0, dr = 0, moves = 0, illegal = 0;
  for (let n = 0; n < games; n++) {
    const candIsBlack = n % 2 === 1;
    const b = gNew();
    let who = 1, m = 0, winner = 0;
    while (m < GN * GN) {
      let pt;
      if (m < 2) pt = openSpot(b);
      else {
        const cand = (who === 1) === candIsBlack;
        const w = cand ? wB : [1, 1.05];
        pt = who === 1 ? bestV(b, 1, 2, w[0], w[1]) : bestV(b, 2, 1, w[0], w[1]);
      }
      if (!legal(pt, b)) { illegal++; break; }
      b[pt[0]][pt[1]] = who;
      m++;
      if (gWin(b, pt[0], pt[1], who)) { winner = who; break; }
      who = 3 - who;
    }
    if (!winner) dr++;
    else if ((winner === 1) === candIsBlack) bw++;
    else aw++;
    moves += m;
  }
  return { bw, aw, dr, avg: moves / games, illegal };
}

const games = Math.max(1, parseInt(process.argv[2], 10) || 10);
const combos = [[1, 1.05], [1.3, 0.9], [1.6, 0.7], [2, 0.6], [1, 0.5]];

console.log(`每组 ${games} 盘，粗筛取前 ${TOPN}。黑 = 原版(1, 1.05)，白 = 候选。`);
const all = { bw: 0, aw: 0, dr: 0 };
for (const w of combos) {
  const r = match(w, games);
  const isCtl = w[0] === 1 && w[1] === 1.05;
  console.log(`  进攻 ${w[0]} 防守 ${w[1]}${isCtl ? ' （对照组）' : ''}：白胜 ${r.bw}  黑胜 ${r.aw}  和 ${r.dr}  平均 ${r.avg.toFixed(1)} 手${r.illegal ? `  非法 ${r.illegal}` : ''}`);
  if (isCtl) continue;
  all.bw += r.bw; all.aw += r.aw; all.dr += r.dr;
}
console.log(`  合计（不含对照）：白胜 ${all.bw}  黑胜 ${all.aw}  和 ${all.dr}`);
