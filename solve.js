// Fast exact drop-in for makefun-diff 1.0.0 (make.fun's own line diff).
// Written fresh in this session. For { old, new } it returns exactly the patch
// string makefun-diff 1.0.0 returns: the same lines, the same Myers greedy
// search with make.fun's deletion-preferred tie-break, the same hunks
// (3 context lines, runs at most 6 kept lines apart sharing a hunk).
//
// Speed comes from three places, none of which changes an answer:
//  - lines are interned to small integers once, so the search compares ints;
//  - the Myers search keeps its trace in one flat Int32Array (row d at d*d),
//    so backtracking replays the exact forward choices;
//  - the patch is built from bulk substrings of the inputs (one native
//    replace per run) instead of one string allocation per output line.

/** The patch's first word. */
const FORMAT = 'makefun-diff/1';

/** The kept lines a hunk shows before and after each change run. */
const CONTEXT = 3;

/** Line separator inside a run segment. Shared: String.replace resets it. */
const NL = /\n/g;

/** Run kinds: kept, deleted, inserted. */
const KEEP = 0;
const DELETE = 1;
const INSERT = 2;

/**
 * One run segment of the patch: lines [i, j) of `text`, each prefixed with
 * `op`. `starts` holds each line's start offset, with starts[count] at the
 * text's end. A last line without a trailing newline is written with one and
 * followed by a line "%".
 */
function segment(op, text, starts, i, j) {
  if (i >= j) return '';
  const sub = text.slice(starts[i], starts[j]);
  if (sub.endsWith('\n')) {
    return op + sub.slice(0, -1).replace(NL, '\n' + op) + '\n';
  }
  return op + sub.replace(NL, '\n' + op) + '\n%\n';
}

/** make.fun's own patch of input.old into input.new (the header's rule). */
export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const oldText = input.old;
  const newText = input.new;

  // Split into lines. A text is cut after every '\n'; a last line with no
  // '\n' is a line too. The empty text has no lines; '\n' has one empty line.
  const aParts = oldText.split('\n');
  const bParts = newText.split('\n');
  const aLast = aParts.length - 1;
  const bLast = bParts.length - 1;
  const aHasLast = aParts[aLast] !== '';
  const bHasLast = bParts[bLast] !== '';
  const n = aParts.length - (aHasLast ? 0 : 1);
  const m = bParts.length - (bHasLast ? 0 : 1);
  const aMid = aHasLast ? n - 1 : n;
  const bMid = bHasLast ? m - 1 : m;

  // Intern the middle lines (each ends in '\n') to small integers, one Map
  // shared by both texts so equal lines share an id. A last line (no '\n')
  // never equals a middle line, so last lines live past every middle id.
  const ids = new Map();
  let nextId = 1;
  const A = new Int32Array(n);
  const B = new Int32Array(m);
  for (let i = 0; i < aMid; i++) {
    const s = aParts[i];
    let v = ids.get(s);
    if (v === undefined) { v = nextId++; ids.set(s, v); }
    A[i] = v;
  }
  for (let i = 0; i < bMid; i++) {
    const s = bParts[i];
    let v = ids.get(s);
    if (v === undefined) { v = nextId++; ids.set(s, v); }
    B[i] = v;
  }
  if (aHasLast) A[n - 1] = nextId;
  if (bHasLast) B[m - 1] = (aHasLast && bParts[bLast] === aParts[aLast]) ? nextId : nextId + 1;

  // Each line's start offset in its text, with [count] at the text's end.
  const aStart = new Int32Array(n + 1);
  const bStart = new Int32Array(m + 1);
  let pos = 0;
  for (let i = 0; i < aLast; i++) { aStart[i] = pos; pos += aParts[i].length + 1; }
  if (aHasLast) aStart[n - 1] = pos;
  aStart[n] = oldText.length;
  pos = 0;
  for (let i = 0; i < bLast; i++) { bStart[i] = pos; pos += bParts[i].length + 1; }
  if (bHasLast) bStart[m - 1] = pos;
  bStart[m] = newText.length;

  // The common prefix, then the common suffix of what is left.
  let pre = 0;
  while (pre < n && pre < m && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (suf < n - pre && suf < m - pre && A[n - 1 - suf] === B[m - 1 - suf]) suf++;
  const nMid = n - pre - suf;
  const mMid = m - pre - suf;
  const a = A.subarray(pre, n - suf);
  const b = B.subarray(pre, m - suf);

  // Myers's greedy search over the middle, with the trace kept: one
  // Int32Array per d (length 2d+1, index k+d), so no giant flat buffer.
  const rows = [];
  let x = 0;
  let y = 0;
  while (x < nMid && y < mMid && a[x] === b[y]) { x++; y++; }
  const row0 = new Int32Array(1);
  row0[0] = x;
  rows.push(row0);
  let D = -1;
  if (x >= nMid && y >= mMid) D = 0;
  for (let d = 1; D < 0 && d <= nMid + mMid; d++) {
    const row = new Int32Array(2 * d + 1);
    rows.push(row);
    const prevRow = rows[d - 1];
    for (let k = -d; k <= d; k += 2) {
      // The d-1 path on k-1 (deletion) or on k+1 (insertion); a diagonal
      // outside [-(d-1), d-1] has no path. A move past either text's end is
      // no candidate, and no edge diagonal is pruned.
      const xDelPrev = k > -d ? prevRow[k + d - 2] : -1;
      const xInsPrev = k < d ? prevRow[k + d] : -1;
      const delOk = xDelPrev >= 0 && xDelPrev < nMid;
      const insOk = xInsPrev >= 0 && (xInsPrev - (k + 1)) < mMid;
      if (!delOk && !insOk) { row[k + d] = -1; continue; }
      const xDel = xDelPrev + 1;
      const xIns = xInsPrev;
      // The candidate further into the old text, the deletion when both
      // reach the same point.
      x = (delOk && (!insOk || xDel >= xIns)) ? xDel : xIns;
      y = x - k;
      while (x < nMid && y < mMid && a[x] === b[y]) { x++; y++; }
      row[k + d] = x;
      if (x >= nMid && y >= mMid) { D = d; break; }
    }
  }
  if (D < 0) throw new Error('makefun-diff: the search ended without reaching both ends');

  // Walk the trace back from (nMid, mMid): at each d the forward choice is
  // replayed from the d-1 row, so the script is the search's own. The runs
  // collect in reverse, then flip to forward order.
  const runsRev = [];
  const pushRev = (kind, count) => {
    const last = runsRev[runsRev.length - 1];
    if (last !== undefined && last.kind === kind) last.count += count;
    else runsRev.push({ kind, count });
  };
  let cx = nMid;
  let cy = mMid;
  for (let d = D; d > 0; d--) {
    const k = cx - cy;
    const prevRow = rows[d - 1];
    const xDelPrev = k > -d ? prevRow[k + d - 2] : -1;
    const xInsPrev = k < d ? prevRow[k + d] : -1;
    const delOk = xDelPrev >= 0 && xDelPrev < nMid;
    const insOk = xInsPrev >= 0 && (xInsPrev - (k + 1)) < mMid;
    const xDel = xDelPrev + 1;
    const xIns = xInsPrev;
    if (delOk && (!insOk || xDel >= xIns)) {
      const keep = cx - xDel;
      if (keep > 0) pushRev(KEEP, keep);
      pushRev(DELETE, 1);
      cx = xDelPrev;
      cy = xDelPrev - (k - 1);
    } else if (insOk) {
      const keep = cx - xIns;
      if (keep > 0) pushRev(KEEP, keep);
      pushRev(INSERT, 1);
      cx = xInsPrev;
      cy = xInsPrev - (k + 1);
    } else {
      throw new Error('makefun-diff: the trace has no path back');
    }
  }
  if (cx > 0) pushRev(KEEP, cx);
  runsRev.reverse();

  // The full runs: the kept prefix, the middle's runs, the kept suffix.
  const runs = [];
  if (pre > 0) runs.push({ kind: KEEP, count: pre });
  for (const r of runsRev) runs.push(r);
  if (suf > 0) runs.push({ kind: KEEP, count: suf });

  // The change runs: each a stretch of deletions and insertions between two
  // kept lines, at old line o and new line p.
  const changes = [];
  let o = 0;
  let p = 0;
  let deleted = 0;
  let inserted = 0;
  for (const r of runs) {
    if (r.kind === KEEP) {
      o += r.count;
      p += r.count;
      continue;
    }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) {
      c = { o, p, dels: 0, ins: 0 };
      changes.push(c);
    }
    if (r.kind === DELETE) {
      c.dels += r.count;
      o += r.count;
      deleted += r.count;
    } else {
      c.ins += r.count;
      p += r.count;
      inserted += r.count;
    }
  }

  // The hunks: change runs at most 2 * CONTEXT kept lines apart share one.
  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prevC = h !== undefined ? h[h.length - 1] : undefined;
    if (prevC !== undefined && c.o - (prevC.o + prevC.dels) <= 2 * CONTEXT) h.push(c);
    else hunks.push([c]);
  }
  const out = [`${FORMAT} old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - CONTEXT);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(CONTEXT, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      out.push(segment('=', oldText, aStart, at, c.o));
      out.push(segment('-', oldText, aStart, c.o, c.o + c.dels));
      out.push(segment('+', newText, bStart, c.p, c.p + c.ins));
      at = c.o + c.dels;
    }
    out.push(segment('=', oldText, aStart, at, oldEnd));
  }
  return out.join('');
}
