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
        <div className="board card">
            {cells.map(({ i, j, k }) => {
                const v = board?.[i]?.[j] ?? 0;
                const isFocus = focus && focus.i === i && focus.j === j;
                const thickRight = (j + 1) % 3 === 0 && j !== 8;
                const thickBottom = (i + 1) % 3 === 0 && i !== 8;

                const phase = isFocus ? (focus?.phase || null) : null;
                const cls = [
                    "cell",
                    v === 0 ? "cell-zero" : "",
                    isFocus ? "cell-focus" : "",
                    phase === "set" ? "cell-set" : "",
                    phase === "back" ? "cell-back" : "",
                    thickRight ? "cell-thick-r" : "",
                    thickBottom ? "cell-thick-b" : "",
                ].join(" ");

                return (
                    <div key={k} className={cls}>
                        {v === 0 ? "" : v}
                    </div>
                );
            })}
        </div>
    );
}