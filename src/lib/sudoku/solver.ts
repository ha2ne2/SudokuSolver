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
 * 可視化対応ソルバー（MRV + バックトラック）
 * - 各反復で空きマスの候補数を評価し、候補が最少のマスから埋める
 * - 候補が尽きたら履歴を遡って別候補を試す
 * - scan / set / back イベントで進行状況を通知
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
  const snap = (b: Board): Board => (typeof structuredClone === "function" ? structuredClone(b) : JSON.parse(JSON.stringify(b)) as Board);
  const aborted = () => signal?.aborted;

  // ---- データ構造 ----
  const candidates: number[][][] = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]));
  const blanks: Coord[] = findBlanks(board);
  const history: Coord[] = [];
  let i = 0, j = 0;

  // ---- メインループ ----
  while (true) {
    if (aborted()) throw new Error("aborted");

    // 候補最少の空きマスを探す
    let minCand = Number.POSITIVE_INFINITY;
    let minBlankIndex = -1;

    for (let k = 0; k < blanks.length; k++) {
      const [ii, jj] = blanks[k];
      if (board[ii][jj] !== 0) continue; // 既に確定

      onStep?.(ii, jj, "scan", snap(board));
      await stepWait();
      if (aborted()) throw new Error("aborted");

      candidates[ii][jj] = findCandidates(board, ii, jj);
      const len = candidates[ii][jj].length;
      if (len < minCand) {
        minCand = len;
        minBlankIndex = k;
      }
    }

    // 未確定マスが残っていない → 完了
    if (minBlankIndex === -1) break;

    [i, j] = blanks[minBlankIndex];

    // 候補が無ければバックトラック
    if (candidates[i][j].length === 0) {
      let last = history.at(-1);
      if (!last) throw new Error("解なし");
      [i, j] = last;

      while (!candidates[i][j].length) {
        board[i][j] = 0; // 直前の仮置きを取り消し
        onStep?.(i, j, "back", snap(board));
        await stepWait();
        if (aborted()) throw new Error("aborted");

        history.pop();
        last = history.at(-1);
        if (!last) throw new Error("解なし");
        [i, j] = last;
      }
    }

    // 候補から1つ選んで配置
    board[i][j] = pickAndRemove(candidates[i][j])!;
    onStep?.(i, j, "set", snap(board));
    await stepWait();
    if (aborted()) throw new Error("aborted");

    history.push([i, j]);

    if (history.length === blanks.length) break; // すべて埋まった
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
