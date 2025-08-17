import React, { useRef, useState, useEffect } from "react";
import { BoardView } from "../../ui/BoardView";
import { generateProblem } from "../../lib/sudoku/generator";
import { check } from "../../lib/sudoku/check";
import { deepCopy } from "../../lib/sudoku/utils";
import { solveVisual } from "../../lib/sudoku/solver";
import type { Board, Phase } from "../../lib/sudoku/types";

export function SudokuSolverVisualizer({ deleteCount = 40 }: { deleteCount?: number }) {
    const [[expected, board], setPair] = useState<[Board, Board]>(() => generateProblem(deleteCount));
    const [focus, setFocus] = useState<{ i: number; j: number; phase: Phase } | null>(null);
    const [speed, setSpeed] = useState(60); // 大きいほどゆっくり
    const speedRef = useRef(speed);
    const [running, setRunning] = useState(false);
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [ok, setOk] = useState<boolean | null>(null);
    const initialRef = useRef<[Board, Board] | null>(null);

    useEffect(() => {
        initialRef.current = deepCopy([expected, board]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGenerate = () => {
        const next = generateProblem(deleteCount);
        setPair(next);
        initialRef.current = deepCopy(next);
        setOk(null);
        setFocus(null);
        setElapsed(0);
        setPaused(false);
        pausedRef.current = false;
    };

    const handleSolve = async () => {
        if (running) return;
        setRunning(true);
        setOk(null);
        setPaused(false);
        pausedRef.current = false;
        const work = deepCopy(board);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const t0 = performance.now();
        try {
            const solved = await solveVisual(work, {
                getWaitMs: () => speedRef.current,
                getPaused: () => pausedRef.current,
                signal: ctrl.signal,
                onStep: (i, j, phase, snap) => {
                    setPair([expected, snap]);
                    setFocus({ i, j, phase });
                },
            });
            const t1 = performance.now();
            setElapsed(t1 - t0);
            setOk(check(expected, solved));
        } catch (e) {
            // 中断時
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    };

    return (
        <div className="visualizer-grid">
            <BoardView board={board} focus={focus} />
            <div className="toolbar card">
                <button onClick={handleGenerate} disabled={running} className="btn btn-ghost">
                    問題を作る（空き{deleteCount}）
                </button>

                <button
                    onClick={() => {
                        if (!running) {
                            handleSolve();
                        } else {
                            setPaused((p) => { const np = !p; pausedRef.current = np; return np; });
                        }
                    }}
                    className={`btn ${!running ? 'btn-primary' : (paused ? 'btn-success' : 'btn-secondary')}`}
                >
                    {!running ? "再生" : (paused ? "再開" : "停止")}
                </button>

                <button
                    onClick={() => {
                        abortRef.current?.abort();
                        if (initialRef.current) {
                            const [e, b] = deepCopy(initialRef.current);
                            setPair([e, b]);
                        }
                        setFocus(null);
                        setElapsed(0);
                        setOk(null);
                        setPaused(false);
                        pausedRef.current = false;
                        setRunning(false);
                    }}
                    className="btn btn-danger"
                >
                    リセット
                </button>

                <label className="label compact">
                    速度: <span className="label-value">{speed}</span>
                    <input
                        type="range"
                        min={0}
                        max={300}
                        value={speed}
                        onChange={(e) => { const v = Number(e.target.value); setSpeed(v); speedRef.current = v; }}
                        className="slider"
                    />
                </label>
            </div>

            <div className="stats">
                所要時間: <strong>{elapsed ? `${elapsed.toFixed(2)} ms` : "-"}</strong> ／ 正解一致: <strong>{ok === null ? "-" : ok ? "OK" : "NG"}</strong>
            </div>

        </div>
    );
}

