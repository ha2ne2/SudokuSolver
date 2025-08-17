import type { Board } from "./types";

/**
 * 数独の完成盤が妥当かを検査する（9x9 / 各行・各列・各3x3ボックスに 1〜9 が一度ずつ）
 * - 0 や範囲外の数値が含まれていれば false
 * - 重複があれば false
 * - 盤面サイズが 9x9 でなければ false
 */
export function check(board: Board): boolean {
  // 形状チェック
  if (!Array.isArray(board) || board.length !== 9) return false;
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(board[r]) || board[r].length !== 9) return false;
  }

  const inRange = (v: unknown): v is number =>
    Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 9;

  // 行チェック
  for (let r = 0; r < 9; r++) {
    const seen = new Set<number>();
    for (let c = 0; c < 9; c++) {
      const v = board[r][c];
      if (!inRange(v) || seen.has(v)) return false;
      seen.add(v);
    }
  }

  // 列チェック
  for (let c = 0; c < 9; c++) {
    const seen = new Set<number>();
    for (let r = 0; r < 9; r++) {
      const v = board[r][c];
      if (!inRange(v) || seen.has(v)) return false;
      seen.add(v);
    }
  }

  // 3x3 ボックスチェック
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const seen = new Set<number>();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const v = board[br + r][bc + c];
          if (!inRange(v) || seen.has(v)) return false;
          seen.add(v);
        }
      }
    }
  }

  return true;
}