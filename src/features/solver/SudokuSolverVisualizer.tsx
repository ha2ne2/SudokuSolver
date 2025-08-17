import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import { BoardView } from "../../ui/BoardView";
import { generateProblem } from "../../lib/sudoku/generator";
import { check } from "../../lib/sudoku/check";
import { deepCopy } from "../../lib/sudoku/utils";
import { solveVisual } from "../../lib/sudoku/solver";
import type { Board, Phase } from "../../lib/sudoku/types";

type Focus = { i: number; j: number; phase?: Phase } | null;

const clone = (b: Board) =>
    (typeof structuredClone === "function" ? structuredClone(b) : JSON.parse(JSON.stringify(b))) as Board;

export function SudokuSolverVisualizer({ deleteCount = 40 }: { deleteCount?: number }) {
    const [[expected, board], setPair] = useState<[Board, Board]>(() => generateProblem(deleteCount));
    const [focus, setFocus] = useState<Focus>(null);
    const [speed, setSpeed] = useState(60); // 大きいほどゆっくり
    const speedRef = useRef(speed);
    const [running, setRunning] = useState(false);
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [ok, setOk] = useState<boolean | null>(null);
    const initialRef = useRef<[Board, Board] | null>(null);

    // 追加: 編集モード & 与えられロック（見た目用途）
    const [editMode, setEditMode] = useState(true);

    useEffect(() => {
        initialRef.current = deepCopy([expected, board]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 速度に応じてセルの transition 時間を更新（0 なら即時）
    const applyAnimDuration = (ms: number) => {
        const dur = ms <= 0 ? "0ms" : Math.max(0, ms - 8) + "ms";
        document.documentElement.style.setProperty("--cell-dur", dur);
        document.documentElement.classList.toggle("no-anim", ms <= 0);
    };
    useEffect(() => { applyAnimDuration(speed); }, [speed]);

    const handleGenerate = () => {
        const next = generateProblem(deleteCount);
        setPair(next);
        initialRef.current = deepCopy(next);
        setOk(null);
        setFocus(null);
        setElapsed(0);
        setPaused(false);
        pausedRef.current = false;
        setEditMode(true);
    };

    const handleSolve = async () => {
        if (running) return;
        setRunning(true);
        setOk(null);
        setPaused(false);
        pausedRef.current = false;
        setEditMode(false); // 実行中は編集不可

        const work = clone(board);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const t0 = performance.now();

        try {
            const solved = await solveVisual(work, {
                getWaitMs: () => speedRef.current,
                getPaused: () => pausedRef.current,
                signal: ctrl.signal,
                onStep: (i, j, phase, snap) => {
                    setPair(([e]) => [e, snap]);
                    setFocus({ i, j, phase });
                },
            });
            const t1 = performance.now();
            setElapsed(t1 - t0);
            setOk(check(solved));
        } catch {
            // 中断時は握りつぶし
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    };

    // 追加: 編集操作（クリックで 0→1→…→9→0）
    const cycleCell = (i: number, j: number) => {
        if (!editMode || running) return;
        setPair(([e, b]) => {
            const nb = clone(b);
            nb[i][j] = (nb[i][j] + 1) % 10;
            return [e, nb];
        });
        setFocus({ i, j });
    };

    // 追加: キーボード編集（0–9 / BS / Delete / 矢印移動）
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!editMode || running) return;
        if (!focus) return;
        const { i, j } = focus;

        const move = (di: number, dj: number) =>
            setFocus({ i: Math.max(0, Math.min(8, i + di)), j: Math.max(0, Math.min(8, j + dj)) });

        if (e.key >= "0" && e.key <= "9") {
            const v = parseInt(e.key, 10);
            setPair(([e0, b]) => {
                const nb = clone(b);
                nb[i][j] = v;
                return [e0, nb];
            });
            return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
            setPair(([e0, b]) => {
                const nb = clone(b);
                nb[i][j] = 0;
                return [e0, nb];
            });
            return;
        }
        if (e.key === "ArrowUp") return move(-1, 0);
        if (e.key === "ArrowDown") return move(1, 0);
        if (e.key === "ArrowLeft") return move(0, -1);
        if (e.key === "ArrowRight") return move(0, 1);
    };

    // 追加: JSON 入出力
    const exportJSON = () => {
        const data = JSON.stringify(board);
        navigator.clipboard?.writeText(data).catch(() => { });
        alert("Board JSON をクリップボードにコピーしました");
    };
    const importJSON = () => {
        if (running) return;
        const s = prompt("Board JSON を貼り付けてください");
        if (!s) return;
        try {
            const b = JSON.parse(s);
            if (!Array.isArray(b) || b.length !== 9) throw new Error("invalid");
            setPair(([e]) => [e, b]);
            setEditMode(true);
            setOk(null);
            setElapsed(0);
        } catch {
            alert("JSONが不正です");
        }
    };

    return (
        <div className="visualizer-grid" tabIndex={0} onKeyDown={onKeyDown}>
            {/* 盤ビュー（BoardView に onCellClick を渡せる前提。渡せない場合は BoardView を拡張してください） */}
            <BoardView
                board={board}
                focus={
                    focus
                        ? { i: focus.i, j: focus.j, phase: (focus.phase ?? "scan") as Phase }
                        : null
                }
                onCellClick={(i, j) => cycleCell(i, j)}
                editable={editMode && !running}
            />

            {/* 操作パネル */}
            <div className="toolbar card">
                <button onClick={handleGenerate} disabled={running} className="btn btn-ghost">
                    問題を作る（空き{deleteCount}）
                </button>

                <button
                    onClick={() => {
                        if (!running) {
                            handleSolve();
                        } else {
                            setPaused((p) => {
                                const np = !p;
                                pausedRef.current = np;
                                return np;
                            });
                        }
                    }}
                    className={`btn ${!running ? "btn-primary" : paused ? "btn-success" : "btn-secondary"}`}
                >
                    {!running ? "開始" : paused ? "再開" : "停止"}
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
                        setEditMode(true);
                    }}
                    className="btn btn-danger"
                >
                    リセット
                </button>

                <button onClick={importJSON} disabled={running} className="btn">インポート</button>
                <button onClick={exportJSON} className="btn">エクスポート</button>

                <label className="label compact">
                    速度: <span className="label-value">{speed}</span>
                    <input
                        type="range"
                        min={0}
                        max={300}
                        value={speed}
                        onChange={(e) => {
                            const v = Number(e.target.value);
                            setSpeed(v);
                            speedRef.current = v;
                        }}
                        className="slider"
                    />
                </label>

                <label className="label compact" style={{ marginLeft: 8 }}>
                    編集モード: <strong>{editMode ? "ON" : "OFF"}</strong>{" "}
                    <button className="btn btn-ghost" onClick={() => setEditMode((m) => !m)} disabled={running} style={{ marginLeft: 8 }}>
                        切替
                    </button>
                </label>
            </div>

            <div className="stats">
                所要時間: <strong>{elapsed ? `${elapsed.toFixed(2)} ms` : "-"}</strong>{" "}
                ／ 完成盤の正しさ: <strong>{ok === null ? "-" : ok ? "OK" : "NG"}</strong>
            </div>
        </div>
    );
}
