#!/usr/bin/env node
'use strict';

// 小鲸鱼的棋牌桌：五子棋 / 黑白棋 / 井字棋，无依赖，终端里下。
// node play.js

const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// 自己攒一份输入队列：人手打字和管道喂进来的都能处理。
const queue = [];
const waiters = [];
rl.on('line', (line) => {
  if (waiters.length) waiters.shift()(line);
  else queue.push(line);
});

function ask(prompt) {
  process.stdout.write(prompt);
  if (queue.length) return Promise.resolve(queue.shift());
  return new Promise((resolve) => waiters.push(resolve));
}

// 被 head / 管道掐断时安静退出，别甩一屏栈
process.stdout.on('error', (e) => {
  if (e && e.code === 'EPIPE') process.exit(0);
});

const say = (s = '') => process.stdout.write(s + '\n');

/* ========================= 五子棋 ========================= */

const GN = 15;
const GCOL = 'ABCDEFGHIJKLMNO'.split('');
const GDIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function gNew() {
  return Array.from({ length: GN }, () => Array(GN).fill(0));
}

function gRender(b) {
  let out = '   ' + GCOL.join(' ') + '\n';
  for (let r = 0; r < GN; r++) {
    let row = String(r + 1).padStart(2, ' ') + ' ';
    for (let c = 0; c < GN; c++) {
      row += (b[r][c] === 0 ? '·' : b[r][c] === 1 ? '●' : '○') + ' ';
    }
    out += row + '\n';
  }
  return out.replace(/\n$/, '');
}

function gParse(s) {
  const t = String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let L = null;
  let D = null;
  const a = /^([A-O])(\d{1,2})$/.exec(t);
  if (a) { L = a[1]; D = a[2]; }
  const b = /^(\d{1,2})([A-O])$/.exec(t);
  if (!L && b) { L = b[2]; D = b[1]; }
  if (!L) return null;
  const r = parseInt(D, 10) - 1;
  const c = L.charCodeAt(0) - 65;
  if (r < 0 || r >= GN || c < 0 || c >= GN) return null;
  return { r, c };
}

function gRun(b, r, c, who, dr, dc) {
  let n = 1;
  let open = 0;
  for (const sgn of [1, -1]) {
    let rr = r + dr * sgn;
    let cc = c + dc * sgn;
    while (rr >= 0 && rr < GN && cc >= 0 && cc < GN && b[rr][cc] === who) {
      n++;
      rr += dr * sgn;
      cc += dc * sgn;
    }
    if (rr >= 0 && rr < GN && cc >= 0 && cc < GN && b[rr][cc] === 0) open++;
  }
  return { n, open };
}

function gWin(b, r, c, who) {
  for (const [dr, dc] of GDIRS) {
    if (gRun(b, r, c, who, dr, dc).n >= 5) return true;
  }
  return false;
}

function gScore(b, r, c, who) {
  b[r][c] = who;
  let sum = 0;
  for (const [dr, dc] of GDIRS) {
    const { n, open } = gRun(b, r, c, who, dr, dc);
    let s;
    if (n >= 5) s = 1000000;
    else if (n === 4) s = open === 2 ? 100000 : open === 1 ? 10000 : 0;
    else if (n === 3) s = open === 2 ? 5000 : open === 1 ? 500 : 0;
    else if (n === 2) s = open === 2 ? 300 : open === 1 ? 50 : 0;
    else s = open === 2 ? 10 : open === 1 ? 5 : 0;
    sum += s;
  }
  b[r][c] = 0;
  return sum;
}

function gCandidates(b) {
  const stones = [];
  for (let r = 0; r < GN; r++) {
    for (let c = 0; c < GN; c++) if (b[r][c] !== 0) stones.push([r, c]);
  }
  if (!stones.length) return [[7, 7]];
  const seen = new Set();
  const out = [];
  for (const [r, c] of stones) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= GN || cc < 0 || cc >= GN) continue;
        if (b[rr][cc] !== 0) continue;
        const k = rr * GN + cc;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push([rr, cc]);
      }
    }
  }
  return out;
}

function gBest(b, ai, human) {
  const cands = gCandidates(b);
  for (const [r, c] of cands) {
    if (gScore(b, r, c, ai) >= 1000000) return [r, c];
  }
  let best = cands[0];
  let bestS = -1;
  for (const [r, c] of cands) {
    const s = gScore(b, r, c, ai) + gScore(b, r, c, human) * 0.9;
    if (s > bestS) {
      bestS = s;
      best = [r, c];
    }
  }
  return best;
}

function gLabel(r, c) {
  return GCOL[c] + (r + 1);
}

async function playGomoku() {
  const b = gNew();
  const hist = [];
  say('五子棋：你先，黑子。输入坐标，比如 H8。想悔棋输 u。');
  say(gRender(b));
  while (true) {
    const raw = (await ask('你(●)：')).trim();
    if (!raw || /^(q|quit|exit|退出)$/i.test(raw)) return;
    if (/^(u|undo|悔棋|悔)$/i.test(raw)) {
      if (!hist.length) {
        say('还没下呢，悔什么。');
        continue;
      }
      while (hist.length) {
        const m = hist.pop();
        b[m.r][m.c] = 0;
        if (m.who === 1) break;
      }
      say(gRender(b));
      continue;
    }
    const p = gParse(raw);
    if (!p || b[p.r][p.c] !== 0) {
      say('这手不行，换一个。');
      continue;
    }
    b[p.r][p.c] = 1;
    hist.push({ r: p.r, c: p.c, who: 1 });
    say(gRender(b));
    if (gWin(b, p.r, p.c, 1)) {
      say('你赢了。行吧。');
      return;
    }
    const mv = gBest(b, 2, 1);
    if (!mv) {
      say('没地方下了，和棋。');
      return;
    }
    b[mv[0]][mv[1]] = 2;
    hist.push({ r: mv[0], c: mv[1], who: 2 });
    say(gRender(b));
    say('我下 ' + gLabel(mv[0], mv[1]));
    if (gWin(b, mv[0], mv[1], 2)) {
      say('我赢了。');
      return;
    }
  }
}

/* ========================= 黑白棋 ========================= */

const ON = 8;
const OCOL = 'ABCDEFGH'.split('');
const OD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

const W = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

function oInit() {
  const b = Array.from({ length: ON }, () => Array(ON).fill(0));
  b[3][3] = -1;
  b[4][4] = -1;
  b[3][4] = 1;
  b[4][3] = 1;
  return b;
}

function oRender(b) {
  let out = '   ' + OCOL.join(' ') + '\n';
  for (let r = 0; r < ON; r++) {
    let row = String(r + 1).padStart(2, ' ') + ' ';
    for (let c = 0; c < ON; c++) {
      row += (b[r][c] === 0 ? '·' : b[r][c] === 1 ? '●' : '○') + ' ';
    }
    out += row + '\n';
  }
  return out.replace(/\n$/, '');
}

function oParse(s) {
  const t = String(s).toUpperCase().replace(/[^A-H1-8]/g, '');
  const a = /^([A-H])([1-8])$/.exec(t);
  if (a) return { r: parseInt(a[2], 10) - 1, c: a[1].charCodeAt(0) - 65 };
  const b = /^([1-8])([A-H])$/.exec(t);
  if (b) return { r: parseInt(b[1], 10) - 1, c: b[2].charCodeAt(0) - 65 };
  return null;
}

function oFlips(b, r, c, who) {
  if (r < 0 || r >= ON || c < 0 || c >= ON || b[r][c] !== 0) return null;
  const out = [];
  for (const [dr, dc] of OD) {
    const path = [];
    let rr = r + dr;
    let cc = c + dc;
    while (rr >= 0 && rr < ON && cc >= 0 && cc < ON && b[rr][cc] === -who) {
      path.push([rr, cc]);
      rr += dr;
      cc += dc;
    }
    if (path.length && rr >= 0 && rr < ON && cc >= 0 && cc < ON && b[rr][cc] === who) {
      for (const p of path) out.push(p);
    }
  }
  return out.length ? out : null;
}

function oMoves(b, who) {
  const out = [];
  for (let r = 0; r < ON; r++) {
    for (let c = 0; c < ON; c++) {
      const f = oFlips(b, r, c, who);
      if (f) out.push({ r, c, f, label: OCOL[c] + (r + 1) });
    }
  }
  return out;
}

function oApply(b, r, c, who) {
  const f = oFlips(b, r, c, who);
  if (!f) return false;
  b[r][c] = who;
  for (const [rr, cc] of f) b[rr][cc] = who;
  return true;
}

function oEval(b, me) {
  let s = 0;
  for (let r = 0; r < ON; r++) {
    for (let c = 0; c < ON; c++) {
      const v = b[r][c];
      if (v === me) s += W[r][c];
      else if (v === -me) s -= W[r][c];
    }
  }
  return s;
}

function oSearch(b, who, me, depth, alpha, beta) {
  if (depth === 0) return oEval(b, me);
  const moves = oMoves(b, who);
  if (!moves.length) {
    if (!oMoves(b, -who).length) return oEval(b, me);
    return oSearch(b, -who, me, depth - 1, alpha, beta);
  }
  let best = who === me ? -Infinity : Infinity;
  for (const m of moves) {
    const nb = b.map((row) => row.slice());
    nb[m.r][m.c] = who;
    for (const [rr, cc] of m.f) nb[rr][cc] = who;
    const v = oSearch(nb, -who, me, depth - 1, alpha, beta);
    if (who === me) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

function oBest(b, who, me, depth) {
  const moves = oMoves(b, who);
  let best = moves[0];
  let bestV = who === me ? -Infinity : Infinity;
  for (const m of moves) {
    const nb = b.map((row) => row.slice());
    nb[m.r][m.c] = who;
    for (const [rr, cc] of m.f) nb[rr][cc] = who;
    const v = oSearch(nb, -who, me, depth - 1, -Infinity, Infinity);
    if (who === me ? v > bestV : v < bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

function oCount(b) {
  let a = 0;
  let n = 0;
  for (const row of b) {
    for (const v of row) {
      if (v === 1) a++;
      else if (v === -1) n++;
    }
  }
  return { me: a, ai: n };
}

async function playOthello() {
  const b = oInit();
  const snaps = [];
  say('黑白棋：你执黑（●），先手。输入坐标，比如 D3。p 认输，u 悔棋，q 退出。');
  while (true) {
    say(oRender(b));
    const mine = oMoves(b, 1);
    if (mine.length) {
      const raw = (await ask('你(●)：')).trim();
      if (!raw || /^(q|quit|exit|退出)$/i.test(raw)) return;
      if (/^p$/i.test(raw)) {
        say('认输也算输。');
        return;
      }
      if (/^(u|undo|悔棋|悔)$/i.test(raw)) {
        if (!snaps.length) {
          say('还没下呢，悔什么。');
          continue;
        }
        const prev = snaps.pop();
        for (let r = 0; r < ON; r++) b[r] = prev[r].slice();
        say('悔了。');
        continue;
      }
      const p = oParse(raw);
      if (!p || !oFlips(b, p.r, p.c, 1)) {
        say('这手不行，换一个。');
        continue;
      }
      snaps.push(b.map((row) => row.slice()));
      oApply(b, p.r, p.c, 1);
    } else {
      say('你这轮没得下，跳过我。');
    }
    const theirs = oMoves(b, -1);
    if (theirs.length) {
      const mv = oBest(b, -1, -1, 4);
      oApply(b, mv.r, mv.c, -1);
      say('我下 ' + mv.label);
    } else {
      say('我这边也没得下。');
    }
    if (!oMoves(b, 1).length && !oMoves(b, -1).length) break;
  }
  say(oRender(b));
  const { me, ai } = oCount(b);
  say(`终局：你 ${me}，我 ${ai}。`);
  if (me > ai) say('你赢了。');
  else if (me < ai) say('我赢了。');
  else say('和棋。');
}

/* ========================= 井字棋 ========================= */

function tNew() {
  return Array(9).fill(0);
}

const TLINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function tRender(b) {
  const g = (i) => (b[i] === 0 ? '·' : b[i] === 1 ? 'X' : 'O');
  return [
    `1:${g(0)} 2:${g(1)} 3:${g(2)}`,
    `4:${g(3)} 5:${g(4)} 6:${g(5)}`,
    `7:${g(6)} 8:${g(7)} 9:${g(8)}`,
  ].join('\n');
}

function tWinner(b) {
  for (const [a, c, d] of TLINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return 0;
}

function tMini(b, who) {
  const w = tWinner(b);
  if (w) return w === 1 ? 1 : -1;
  if (!b.includes(0)) return 0;
  let best = who === 1 ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i] !== 0) continue;
    b[i] = who;
    const v = tMini(b, -who);
    b[i] = 0;
    if (who === 1 ? v > best : v < best) best = v;
  }
  return best;
}

function tBest(b) {
  let best = null;
  let bestV = Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i] !== 0) continue;
    b[i] = -1;
    const v = tMini(b, 1);
    b[i] = 0;
    if (v < bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

async function playTicTacToe() {
  const b = tNew();
  const hist = [];
  say('井字棋：你是 X，先手。输入格子编号 1-9，u 悔棋，q 退出。');
  while (true) {
    say(tRender(b));
    const raw = (await ask('你(X)：')).trim();
    if (!raw || /^(q|quit|exit|退出)$/i.test(raw)) return;
    if (/^(u|undo|悔棋|悔)$/i.test(raw)) {
      if (!hist.length) {
        say('还没下呢，悔什么。');
        continue;
      }
      // 退回到自己上一次落子之前：AI 那手和自己那手一起拿掉
      while (hist.length) {
        const j = hist.pop();
        const wasMine = b[j] === 1;
        b[j] = 0;
        if (wasMine) break;
      }
      say(tRender(b));
      continue;
    }
    const i = parseInt(raw, 10) - 1;
    if (Number.isNaN(i) || i < 0 || i > 8 || b[i] !== 0) {
      say('这手不行，换一个。');
      continue;
    }
    b[i] = 1;
    hist.push(i);
    if (tWinner(b)) {
      say(tRender(b));
      say('你赢了。');
      return;
    }
    if (!b.includes(0)) {
      say(tRender(b));
      say('和棋。');
      return;
    }
    const mv = tBest(b);
    b[mv] = -1;
    hist.push(mv);
    say('我下 ' + (mv + 1));
    if (tWinner(b)) {
      say(tRender(b));
      say('我赢了。');
      return;
    }
    if (!b.includes(0)) {
      say(tRender(b));
      say('和棋。');
      return;
    }
  }
}

/* ========================= 入口 ========================= */

async function main() {
  say('小鲸鱼的棋牌桌');
  say('  1) 五子棋   2) 黑白棋   3) 井字棋   q) 退出');
  const pick = (await ask('选一个：')).trim();
  if (/^(1|五子棋|五子)$/.test(pick)) return playGomoku();
  if (/^(2|黑白棋|黑白|奥赛罗)$/.test(pick)) return playOthello();
  if (/^(3|井字棋|井字)$/.test(pick)) return playTicTacToe();
  say('不选就散了吧。');
}

main().then(() => rl.close()).catch((e) => {
  say('出错了：' + (e && e.message ? e.message : e));
  rl.close();
});
