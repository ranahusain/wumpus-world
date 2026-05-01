export default function ControlPanel({
  rows,
  cols,
  setRows,
  setCols,
  onStart,
  onMove,
  onShoot,
  hasGame,
  gameOver,
}) {
  return (
    <aside className="ww-left">
      {/* ── Episode Config ── */}
      <div className="panel-block">
        <div className="panel-heading">Episode Config</div>
        <div className="dim-inputs">
          <div className="dim-input-wrap">
            <label>Rows</label>
            <input
              type="number"
              min={4}
              max={10}
              value={rows}
              onChange={(e) =>
                setRows(Math.max(4, Math.min(10, +e.target.value)))
              }
            />
          </div>
          <div className="dim-input-wrap">
            <label>Cols</label>
            <input
              type="number"
              min={4}
              max={10}
              value={cols}
              onChange={(e) =>
                setCols(Math.max(4, Math.min(10, +e.target.value)))
              }
            />
          </div>
        </div>
        <button className="btn-ww-primary" onClick={onStart}>
          Initialise Agent
        </button>
      </div>

      {/* ── Movement ── */}
      {hasGame && (
        <div className="panel-block">
          <div className="panel-heading">Movement</div>
          <div className="dpad-grid">
            <div />
            <button
              className="dpad-btn"
              onClick={() => onMove("up")}
              disabled={gameOver}
            >
              ↑
            </button>
            <div />
            <button
              className="dpad-btn"
              onClick={() => onMove("left")}
              disabled={gameOver}
            >
              ←
            </button>
            <div className="dpad-btn dpad-center">MOVE</div>
            <button
              className="dpad-btn"
              onClick={() => onMove("right")}
              disabled={gameOver}
            >
              →
            </button>
            <div />
            <button
              className="dpad-btn"
              onClick={() => onMove("down")}
              disabled={gameOver}
            >
              ↓
            </button>
            <div />
          </div>
          <p
            className="t-label"
            style={{ textAlign: "center", marginTop: 8, marginBottom: 0 }}
          >
            or use arrow keys
          </p>
        </div>
      )}

      {/* ── Shoot Arrow ── */}
      {hasGame && (
        <div className="panel-block">
          <div className="panel-heading">Shoot Arrow</div>
          <div className="shoot-grid">
            {["up", "right", "left", "down"].map((d) => (
              <button
                key={d}
                className="btn-shoot"
                onClick={() => onShoot(d)}
                disabled={gameOver}
              >
                {d === "up"
                  ? "↑ Up"
                  : d === "down"
                    ? "↓ Down"
                    : d === "left"
                      ? "← Left"
                      : "Right →"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="panel-block">
        <div className="panel-heading">Cell Legend</div>

        <div className="legend-row">
          <div
            className="legend-swatch"
            style={{
              background: "var(--agent-bg)",
              borderColor: "var(--agent-rule)",
              borderLeftWidth: 3,
            }}
          />
          <span>Agent position</span>
        </div>
        <div className="legend-row">
          <div
            className="legend-swatch"
            style={{ background: "var(--visited-bg)" }}
          />
          <span>Visited &amp; explored</span>
        </div>
        <div className="legend-row">
          <div
            className="legend-swatch"
            style={{
              background: "var(--safe-bg)",
              borderColor: "var(--safe-rule)",
              borderLeftWidth: 3,
            }}
          />
          <span>KB proven safe</span>
        </div>
        <div className="legend-row">
          <div
            className="legend-swatch"
            style={{ background: "var(--unknown-bg)" }}
          />
          <span>Unknown / unvisited</span>
        </div>
        <div className="legend-row">
          <div
            className="legend-swatch"
            style={{
              background: "var(--hazard-bg)",
              borderColor: "var(--hazard-rule)",
            }}
          />
          <span>Confirmed hazard</span>
        </div>
      </div>
    </aside>
  );
}
