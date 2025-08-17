import type { Board } from "./types";
import { difference, intersection, isEmpty, rnd } from "./utils";

function findCandidates(board: Board, i: number, j: number): number[] {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const rowSet = new Set(board[i]);
  const candRow = difference(base, rowSet);

  const colSet = new Set(board.map((r) => r[j]));
  const candCol = difference(base, colSet);

  const ox = Math.floor(i / 3) * 3;
  const oy = Math.floor(j / 3) * 3;
  const block: number[] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) block.push(board[ox + x][oy + y]);
  const candBlock = difference(base, new Set(block));

  return intersection(candRow, candCol, candBlock);
}

function pickAndRemove<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const idx = Math.floor(Math.random() * arr.length);
  const [v] = arr.splice(idx, 1);
  return v;
}
function next(i: number, j: number): [number | undefined, number | undefined] {
  if (i === 8 && j === 8) return [undefined, undefined];
  if (j === 8) return [i + 1, 0];
  return [i, j + 1];
}
function prev(i: number, j: number): [number | undefined, number | undefined] {
  if (i === 0 && j === 0) return [undefined, undefined];
  if (j === 0) return [i - 1, 8];
  return [i, j - 1];
}

export function generateCompleteBoard(): Board {
  const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0));
  const candidates: (number[] | undefined)[][] = Array.from({ length: 9 }, () => Array(9).fill(undefined));
  let i = 0, j = 0;

  while (true) {
    if (candidates[i][j] === undefined) candidates[i][j] = findCandidates(board, i, j);
    if (isEmpty(candidates[i][j])) {
      candidates[i][j] = undefined;
      const p = prev(i, j);
      i = p[0]!; j = p[1]!;
      if (i === undefined || j === undefined) throw new Error("failed");
      board[i][j] = 0;
      continue;
    }
    const c = pickAndRemove(candidates[i][j]!);
    board[i][j] = c!;
    const n = next(i, j); i = n[0]!; j = n[1]!;
    if (i === undefined || j === undefined) break;
  }
  return board;
}

export function generateProblem(deleteCount: number): [Board, Board] {
  const answer = generateCompleteBoard();
  const board = JSON.parse(JSON.stringify(answer)) as Board;
  let del = 0;
  while (del < deleteCount) {
    const i = rnd(9), j = rnd(9);
    if (board[i][j] !== 0) { board[i][j] = 0; del++; }
  }
  return [answer, board];
}
