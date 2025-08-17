import type { Board, Phase } from "./types";
import { difference, intersection, isEmpty, sleep } from "./utils";

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

export async function solveVisual(
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
