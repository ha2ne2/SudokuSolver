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
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,420px)", gap: 12 }}>
      <BoardView board={board} focus={focus} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={handleGenerate} disabled={running} style={btnStyle}>
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
          style={{ ...btnStyle, background: !running ? "#2563eb" : (paused ? "#16a34a" : "#6b7280") }}
        >
          {!running ? "再生" : (paused ? "再開" : "一時停止")}
        </button>
        <button
          onClick={() => { abortRef.current?.abort(); if (initialRef.current) { const [e,b] = deepCopy(initialRef.current); setPair([e,b]); } setFocus(null); setElapsed(0); setOk(null); setPaused(false); pausedRef.current = false; setRunning(false); }}
          style={{ ...btnStyle, background: "#dc2626" }}
        >
          リセット
        </button>
        <label style={{ marginLeft: 8, fontSize: 13 }}>
          速度: {speed}
          <input
            type="range"
            min={0}
            max={300}
            value={speed}
            onChange={(e) => { const v = Number(e.target.value); setSpeed(v); speedRef.current = v; }}
            style={{ width: 180, verticalAlign: "middle", marginLeft: 8 }}
          />
        </label>
      </div>
      <div style={{ fontSize: 13, color: "#374151" }}>
        所要時間: {elapsed ? `${elapsed.toFixed(2)} ms` : "-"} ／ 正解一致: {ok === null ? "-" : ok ? "OK" : "NG"}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
};
