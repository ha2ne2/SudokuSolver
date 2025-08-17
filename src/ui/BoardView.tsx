import React, { useMemo } from "react";
import type { Board, Phase } from "../lib/sudoku/types";

export function BoardView({
  board,
  focus,
}: {
  board: Board;
  focus: { i: number; j: number; phase: Phase } | null;
}) {
  const cells = useMemo(() => {
    return Array.from({ length: 81 }, (_, k) => ({ i: Math.floor(k / 9), j: k % 9, k }));
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 42px)", gap: 2, background: "#6b7280", padding: 2, borderRadius: 12 }}>
      {cells.map(({ i, j, k }) => {
        const v = board?.[i]?.[j] ?? 0;
        const isFocus = focus && focus.i === i && focus.j === j;
        const thickRight = (j + 1) % 3 === 0 && j !== 8;
        const thickBottom = (i + 1) % 3 === 0 && i !== 8;
        let bg = "#fff", ring = "transparent";
        if (v === 0) bg = "#fafafa";
        if (isFocus) {
          if (focus?.phase === "set") { bg = "#e6ffea"; ring = "#22c55e"; }
          else if (focus?.phase === "back") { bg = "#ffe4e6"; ring = "#ef4444"; }
          else { bg = "#fef9c3"; ring = "#f59e0b"; }
        }
        return (
          <div
            key={k}
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
              background: bg,
              boxShadow: `inset 0 0 0 2px ${ring}`,
              borderRight: thickRight ? "2px solid #111827" : undefined,
              borderBottom: thickBottom ? "2px solid #111827" : undefined,
              color: v === 0 ? "#d1d5db" : "#111827",
            }}
          >
            {v === 0 ? "" : v}
          </div>
        );
      })}
    </div>
  );
}