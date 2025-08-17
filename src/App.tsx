import { useState } from "react";
import { SudokuSolverVisualizer } from "./features/solver/SudokuSolverVisualizer";

export default function App() {
  const [deleteCount, setDeleteCount] = useState(40);
  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#f7f7f8" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Sudoku Solver</h1>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <SudokuSolverVisualizer deleteCount={deleteCount} />
        <div style={{ minWidth: 260 }}>
          <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>
            空きマス: {deleteCount}
            <input
              type="range"
              min={0}
              max={81}
              value={deleteCount}
              onChange={(e) => setDeleteCount(Number(e.target.value))}
              style={{ width: 200, verticalAlign: "middle", marginLeft: 8 }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
