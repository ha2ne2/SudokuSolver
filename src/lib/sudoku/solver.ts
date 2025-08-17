import type { Board, Coord, Phase } from "./types";
import { difference, intersection, isEmpty } from "./utils";

export type { Board, Phase };

function findBlanks(board: Board): Array<[number, number]> {
  const blanks: Array<[number, number]> = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (board[i][j] === 0) blanks.push([i, j]);
  return blanks;
}

function findCandidates(board: Board, i: number, j: number): number[] {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const candRow = difference(base, new Set(board[i]));
  const candCol = difference(base, new Set(board.map((r) => r[j])));
  const ox = Math.floor(i / 3) * 3, oy = Math.floor(j / 3) * 3;
  const block: number[] = []; for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) block.push(board[ox + x][oy + y]);
  const candBlock = difference(base, new Set(block));
  return intersection(candRow, candCol, candBlock);
}

function pickAndRemove<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const idx = Math.floor(Math.random() * arr.length);
  const [v] = arr.splice(idx, 1);
  return v;
}

/**
 * 可視化対応ソルバー（MRV + バックトラック, dirty最適化）
 * - 候補キャッシュ + dirty セットで、影響範囲のみ findCandidates を再計算
 * - scan / set / back の各フェーズで onStep を発火
 * - 一時停止・速度調整・AbortSignal に対応
 */
export async function solveVisual(
  board: Board,
  opts: {
    onStep?: (i: number, j: number, phase: Phase, snapshot: Board) => void;
    getWaitMs?: () => number;  // ステップ待機時間（ms）
    getPaused?: () => boolean; // 一時停止中なら true
    signal?: AbortSignal;      // 中断用シグナル
  } = {}
): Promise<Board> {
  const { onStep, getWaitMs, getPaused, signal } = opts;

  // ---- 補助関数 ----
  const sleep = (ms: number) => new Promise<void>((res, rej) => {
    const id = setTimeout(res, ms);
    signal?.addEventListener("abort", () => { clearTimeout(id); rej(new Error("aborted")); }, { once: true });
  });
  const stepWait = async () => {
    while (getPaused && getPaused()) {
      await sleep(16);
      if (signal?.aborted) throw new Error("aborted");
    }
    const ms = Math.max(0, Math.min(1000, getWaitMs ? getWaitMs() : 40));
    await sleep(ms);
  };
  const snap = (b: Board): Board => (typeof structuredClone === "function" ? structuredClone(b) : (JSON.parse(JSON.stringify(b)) as Board));
  const aborted = () => signal?.aborted;

  // ---- データ構造（候補キャッシュ + dirty） ----
  const candidates: (number[] | undefined)[][] = Array.from({ length: 9 }, () => Array(9).fill(undefined));
  const dirty = new Set<string>(); // 再計算対象セル "i,j"

  const blanks: Coord[] = findBlanks(board);
  const history: Coord[] = [];
  let i = 0, j = 0;

  const key = (r: number, c: number) => `${r},${c}`;

  // 影響範囲（行・列・ボックス）の未確定セルを dirty にする
  function markAffected(r: number, c: number) {
    // 行
    for (let cc = 0; cc < 9; cc++) if (board[r][cc] === 0) dirty.add(key(r, cc));
    // 列
    for (let rr = 0; rr < 9; rr++) if (board[rr][c] === 0) dirty.add(key(rr, c));
    // 3x3 ボックス
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
        if (board[rr][cc] === 0) dirty.add(key(rr, cc));
      }
    }
    if (board[r][c] === 0) dirty.add(key(r, c));
  }

  // 初期は全ブランクセルを dirty に
  for (const [bi, bj] of blanks) if (board[bi][bj] === 0) dirty.add(key(bi, bj));

  // ---- メインループ ----
  while (true) {
    if (aborted()) throw new Error("aborted");

    // 候補最少の空きマスを探す（dirty のみ再計算）
    let minCand = Number.POSITIVE_INFINITY;
    let minBlankIndex = -1;

    for (let k = 0; k < blanks.length; k++) {
      const [ii, jj] = blanks[k];
      if (board[ii][jj] !== 0) continue; // 既に確定

      // dirty または未計算なら再計算（その時だけ可視化の scan を出す）
      if (dirty.has(key(ii, jj)) || candidates[ii][jj] === undefined) {
        onStep?.(ii, jj, "scan", snap(board));
        await stepWait();
        if (aborted()) throw new Error("aborted");
        candidates[ii][jj] = findCandidates(board, ii, jj);
        dirty.delete(key(ii, jj));
      }

      const len = candidates[ii][jj]!.length;
      if (len < minCand) {
        minCand = len;
        minBlankIndex = k;
      }
    }

    // 未確定マスが残っていない → 完了
    if (minBlankIndex === -1) break;

    [i, j] = blanks[minBlankIndex];

    // 候補が無ければバックトラック
    if (!candidates[i][j] || candidates[i][j]!.length === 0) {
      let last = history.pop();
      if (!last) throw new Error("解なし");
      [i, j] = last;

      while (!candidates[i][j] || candidates[i][j]!.length === 0) {
        // 直前の仮置きを取り消し
        board[i][j] = 0;
        onStep?.(i, j, "back", snap(board));
        await stepWait();
        if (aborted()) throw new Error("aborted");

        // 取り消しの影響を周辺に反映
        markAffected(i, j);
        last = history.pop();
        if (!last) throw new Error("解なし");
        [i, j] = last;
      }
    }

    // 候補から1つ選んで配置
    const val = pickAndRemove(candidates[i][j]!);
    board[i][j] = val!;
    onStep?.(i, j, "set", snap(board));
    await stepWait();
    if (aborted()) throw new Error("aborted");

    // 置いた影響を周辺に反映
    markAffected(i, j);

    history.push([i, j]);

    // すべて埋まった
    if (history.length === blanks.length) {
      console.log(blanks,history);
      break;
    }
  }

  // 完成スナップショット（UI取りこぼし対策）
  onStep?.(i, j, "set", snap(board));
  return board;
}


export async function solveVisual_v1(
  board: Board,
  opts: {
    onStep?: (i: number, j: number, phase: Phase, snapshot: Board) => void;
    /** 動的に待機時間を取得（速度スライダー連動） */
    getWaitMs?: () => number;
    /** 一時停止中かどうか（true なら進まない） */
    getPaused?: () => boolean;
    /** 中断用 */
    signal?: AbortSignal;
  } = {}
): Promise<Board> {
  const { onStep, getWaitMs, getPaused, signal } = opts;
  const candidates: (number[] | undefined)[][] = Array.from({ length: 9 }, () => Array(9).fill(undefined));
  const blanks = findBlanks(board);
  let n = 0;

  const sleep = (ms: number) => new Promise<void>((res, rej) => {
    const id = setTimeout(() => res(), ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); rej(new Error('aborted')); }, { once: true });
  });
  const stepWait = async () => {
    // 一時停止中はここで足踏み
    while (getPaused && getPaused()) {
      await sleep(16);
      if (signal?.aborted) throw new Error('aborted');
    }
    const ms = Math.max(0, Math.min(1000, getWaitMs ? getWaitMs() : 40));
    await sleep(ms);
  };
  const aborted = () => signal?.aborted;

  while (n < blanks.length) {
    if (aborted()) throw new Error('aborted');
    const [i, j] = blanks[n];
    board[i][j] = 0;

    if (candidates[i][j] === undefined) {
      onStep?.(i, j, "scan", JSON.parse(JSON.stringify(board)) as Board);
      await stepWait();
      if (aborted()) throw new Error('aborted');
      candidates[i][j] = findCandidates(board, i, j);
    }
    if (isEmpty(candidates[i][j])) {
      candidates[i][j] = undefined;
      onStep?.(i, j, "back", JSON.parse(JSON.stringify(board)) as Board);
      await stepWait();
      if (aborted()) throw new Error('aborted');
      n--;
      continue;
    }
    const c = pickAndRemove(candidates[i][j]!);
    board[i][j] = c!;
    onStep?.(i, j, "set", JSON.parse(JSON.stringify(board)) as Board);
    await stepWait();
    if (aborted()) throw new Error('aborted');
    n++;
  }
  return board;
}
