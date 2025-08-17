import type { Board } from "./types";
export function check(answer: Board, board: Board): boolean {
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (answer[i][j] !== board[i][j]) return false;
  return true;
}