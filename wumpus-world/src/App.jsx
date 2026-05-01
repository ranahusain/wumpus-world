import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import GameGrid from "./components/GameGrid.jsx";
import MetricsDashboard from "./components/MetricsDashboard.jsx";
import ResolutionTrace from "./components/ResolutionTrace.jsx";
import "./App.css";

// ═══════════════════════════════════════════════
//  Propositional Logic — Resolution Engine
// ═══════════════════════════════════════════════

class Literal {
  constructor(name, negated = false) {
    this.name = name;
    this.negated = negated;
  }
  negate() {
    return new Literal(this.name, !this.negated);
  }
  key() {
    return (this.negated ? "¬" : "") + this.name;
  }
  toString() {
    return this.key();
  }
}

class Clause {
  constructor(literals) {
    this.map = new Map();
    for (const l of literals) this.map.set(l.key(), l);
  }
  isEmpty() {
    return this.map.size === 0;
  }
  key() {
    return [...this.map.keys()].sort().join("∨");
  }
  toString() {
    return this.isEmpty()
      ? "⊥"
      : [...this.map.values()].map((l) => l.toString()).join(" ∨ ");
  }
  has(lit) {
    return this.map.has(lit.key());
  }
  literals() {
    return [...this.map.values()];
  }
  minus(lit) {
    return new Clause(this.literals().filter((l) => l.key() !== lit.key()));
  }
  union(other) {
    return new Clause([...this.literals(), ...other.literals()]);
  }
}

function resolve(c1, c2) {
  const out = [];
  for (const lit of c1.literals()) {
    const comp = lit.negate();
    if (c2.has(comp)) out.push(c1.minus(lit).union(c2.minus(comp)));
  }
  return out;
}

function resolutionRefutation(kbClauses, queryLit) {
  const negQuery = new Clause([queryLit.negate()]);
  const clauseMap = new Map();
  for (const c of kbClauses) clauseMap.set(c.key(), c);
  clauseMap.set(negQuery.key(), negQuery);

  let steps = 0;
  const trace = [];
  const MAX = 600;

  while (true) {
    const clauses = [...clauseMap.values()];
    let foundNew = false;

    for (let i = 0; i < clauses.length && steps < MAX; i++) {
      for (let j = i + 1; j < clauses.length && steps < MAX; j++) {
        for (const r of resolve(clauses[i], clauses[j])) {
          steps++;
          trace.push({
            step: steps,
            c1: clauses[i].toString(),
            c2: clauses[j].toString(),
            resolvent: r.toString(),
          });
          if (r.isEmpty()) return { proved: true, steps, trace };
          if (!clauseMap.has(r.key())) {
            clauseMap.set(r.key(), r);
            foundNew = true;
          }
        }
      }
    }
    if (!foundNew || steps >= MAX) break;
  }
  return { proved: false, steps, trace };
}

// ═══════════════════════════════════════════════
//  Knowledge Base
// ═══════════════════════════════════════════════

class KnowledgeBase {
  constructor() {
    this.clauses = new Map();
    this.facts = new Map();
  }

  tell(clause) {
    this.clauses.set(clause.key(), clause);
  }

  tellFact(name, value) {
    this.facts.set(name, value);
    this.tell(new Clause([new Literal(name, !value)]));
  }

  askSafe(r, c) {
    const pv = `P_${r}_${c}`,
      wv = `W_${r}_${c}`;
    if (this.facts.get(pv) || this.facts.get(wv))
      return { safe: false, steps: 0, trace: [] };

    const all = [...this.clauses.values()];
    const rP = resolutionRefutation(all, new Literal(pv, false));
    const rW = resolutionRefutation(all, new Literal(wv, false));
    return {
      safe: rP.proved && rW.proved,
      steps: rP.steps + rW.steps,
      trace: [...rP.trace, ...rW.trace].slice(-12),
    };
  }

  addBreezeRule(r, c, rows, cols) {
    const lits = [
      new Literal(`B_${r}_${c}`, true),
      ...neighbors(r, c, rows, cols).map(
        ([nr, nc]) => new Literal(`P_${nr}_${nc}`),
      ),
    ];
    this.tell(new Clause(lits));
  }

  addStenchRule(r, c, rows, cols) {
    const lits = [
      new Literal(`S_${r}_${c}`, true),
      ...neighbors(r, c, rows, cols).map(
        ([nr, nc]) => new Literal(`W_${nr}_${nc}`),
      ),
    ];
    this.tell(new Clause(lits));
  }

  addNoBreezeConstraints(r, c, rows, cols) {
    for (const [nr, nc] of neighbors(r, c, rows, cols))
      this.tellFact(`P_${nr}_${nc}`, false);
  }

  addNoStenchConstraints(r, c, rows, cols) {
    for (const [nr, nc] of neighbors(r, c, rows, cols))
      this.tellFact(`W_${nr}_${nc}`, false);
  }

  clauseCount() {
    return this.clauses.size;
  }
}

function neighbors(r, c, rows, cols) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < rows && nc < cols);
}

// ═══════════════════════════════════════════════
//  Game Logic
// ═══════════════════════════════════════════════

function sample(arr, n) {
  const a = [...arr];
  const out = [];
  for (let i = 0; i < Math.min(n, a.length); i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
    out.push(a[i]);
  }
  return out;
}

function createGame(rows, cols) {
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push([r, c]);
  const nonStart = cells.filter(([r, c]) => !(r === 0 && c === 0));
  const numPits = Math.max(1, Math.floor((rows * cols) / 6));
  const pits = sample(nonStart, numPits);
  const rem1 = nonStart.filter(
    ([r, c]) => !pits.some((p) => p[0] === r && p[1] === c),
  );
  const gold = rem1[Math.floor(Math.random() * rem1.length)];
  const rem2 = rem1.filter(([r, c]) => !(r === gold[0] && c === gold[1]));
  const wumpus = rem2[Math.floor(Math.random() * rem2.length)];

  const kb = new KnowledgeBase();
  kb.tellFact("P_0_0", false);
  kb.tellFact("W_0_0", false);
  for (const [r, c] of cells) {
    kb.addBreezeRule(r, c, rows, cols);
    kb.addStenchRule(r, c, rows, cols);
  }
  kb.tell(new Clause(cells.map(([r, c]) => new Literal(`W_${r}_${c}`))));

  return {
    rows,
    cols,
    pits,
    wumpus,
    gold,
    agent: [0, 0],
    visited: [[0, 0]],
    safeCells: [[0, 0]],
    confirmedHazards: [],
    hasGold: false,
    gameOver: false,
    win: false,
    wumpusAlive: true,
    percepts: [],
    message: "Agent initialised at (0,0). Begin exploration.",
    kb,
  };
}

function processPercepts(G) {
  const [r, c] = G.agent;
  const ns = neighbors(r, c, G.rows, G.cols);
  const percepts = [];

  const hasBreeze = G.pits.some(([pr, pc]) =>
    ns.some(([nr, nc]) => nr === pr && nc === pc),
  );
  const hasStench =
    G.wumpusAlive &&
    ns.some(([nr, nc]) => nr === G.wumpus[0] && nc === G.wumpus[1]);
  const hasGlitter = r === G.gold[0] && c === G.gold[1] && !G.hasGold;

  if (hasBreeze) {
    percepts.push("Breeze");
    G.kb.tellFact(`B_${r}_${c}`, true);
    G.kb.tell(new Clause([new Literal(`B_${r}_${c}`)]));
  } else {
    percepts.push("No Breeze");
    G.kb.tellFact(`B_${r}_${c}`, false);
    G.kb.addNoBreezeConstraints(r, c, G.rows, G.cols);
  }

  if (hasStench) {
    percepts.push("Stench");
    G.kb.tellFact(`S_${r}_${c}`, true);
    G.kb.tell(new Clause([new Literal(`S_${r}_${c}`)]));
  } else {
    percepts.push("No Stench");
    G.kb.tellFact(`S_${r}_${c}`, false);
    G.kb.addNoStenchConstraints(r, c, G.rows, G.cols);
  }

  if (hasGlitter) percepts.push("Glitter");
  G.percepts = percepts;
}

function inferSafeCells(G) {
  let totalSteps = 0;
  let trace = [];
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (G.visited.some((v) => v[0] === r && v[1] === c)) continue;
      const { safe, steps, trace: t } = G.kb.askSafe(r, c);
      totalSteps += steps;
      trace = [...trace, ...t].slice(-20);
      if (safe && !G.safeCells.some((s) => s[0] === r && s[1] === c))
        G.safeCells.push([r, c]);
    }
  }
  return { steps: totalSteps, trace };
}

// ═══════════════════════════════════════════════
//  App
// ═══════════════════════════════════════════════

export default function App() {
  const [G, setG] = useState(null);
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [totalSteps, setTotalSteps] = useState(0);
  const [resTrace, setResTrace] = useState([]);
  const [kbCount, setKbCount] = useState(0);

  function startGame() {
    const g = createGame(rows, cols);
    processPercepts(g);
    const { steps, trace } = inferSafeCells(g);
    setG({ ...g });
    setTotalSteps(steps);
    setResTrace(trace);
    setKbCount(g.kb.clauseCount());
  }

  const applyMove = useCallback(
    (dir) => {
      if (!G || G.gameOver) return;
      const deltas = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      };
      const [dr, dc] = deltas[dir] || [0, 0];
      const [r, c] = G.agent;
      const nr = r + dr,
        nc = c + dc;

      if (nr < 0 || nc < 0 || nr >= G.rows || nc >= G.cols) {
        setG((prev) => ({
          ...prev,
          message: "Cannot move outside the grid boundary.",
        }));
        return;
      }

      // Deep-copy mutable state (kb is passed by ref — intentional, it's a class)
      const ng = {
        ...G,
        agent: [nr, nc],
        visited: [...G.visited],
        safeCells: [...G.safeCells],
        confirmedHazards: [...G.confirmedHazards],
        percepts: [],
      };

      if (!ng.visited.some((v) => v[0] === nr && v[1] === nc))
        ng.visited.push([nr, nc]);

      if (ng.pits.some(([pr, pc]) => pr === nr && pc === nc)) {
        ng.gameOver = true;
        ng.win = false;
        ng.confirmedHazards.push([nr, nc]);
        ng.message = `Agent fell into a pit at (${nr},${nc}). Episode terminated.`;
        ng.percepts = ["Fell in Pit"];
        return setG(ng);
      }

      if (ng.wumpusAlive && nr === ng.wumpus[0] && nc === ng.wumpus[1]) {
        ng.gameOver = true;
        ng.win = false;
        ng.confirmedHazards.push([nr, nc]);
        ng.message = `Agent consumed by Wumpus at (${nr},${nc}). Episode terminated.`;
        ng.percepts = ["Eaten by Wumpus"];
        return setG(ng);
      }

      processPercepts(ng);
      const { steps, trace } = inferSafeCells(ng);
      setTotalSteps((prev) => prev + steps);
      setResTrace(trace);
      setKbCount(ng.kb.clauseCount());

      if (!ng.hasGold && nr === ng.gold[0] && nc === ng.gold[1]) {
        ng.hasGold = true;
        ng.message = `Gold secured at (${nr},${nc}). Return to origin (0,0).`;
        if (!ng.percepts.includes("Glitter")) ng.percepts.push("Glitter");
      } else if (!ng.gameOver) {
        ng.message = `Agent at (${nr},${nc}) — ${ng.percepts.join(", ")}.`;
      }

      if (ng.hasGold && ng.agent[0] === 0 && ng.agent[1] === 0) {
        ng.gameOver = true;
        ng.win = true;
        ng.message =
          "Episode complete. Gold retrieved and agent returned to origin.";
      }

      setG(ng);
    },
    [G],
  );

  const applyShoot = useCallback(
    (dir) => {
      if (!G || G.gameOver) return;
      const deltas = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      };
      const [dr, dc] = deltas[dir] || [0, 0];
      const [r, c] = G.agent;
      let ar = r + dr,
        ac = c + dc;
      let hit = false;

      while (ar >= 0 && ac >= 0 && ar < G.rows && ac < G.cols) {
        if (G.wumpusAlive && ar === G.wumpus[0] && ac === G.wumpus[1]) {
          hit = true;
          break;
        }
        ar += dr;
        ac += dc;
      }

      const ng = { ...G, confirmedHazards: [...G.confirmedHazards] };
      if (hit) {
        ng.wumpusAlive = false;
        ng.confirmedHazards.push([...G.wumpus]);
        ng.kb.tellFact(`W_${G.wumpus[0]}_${G.wumpus[1]}`, false);
        ng.message = `Arrow struck Wumpus at (${G.wumpus[0]},${G.wumpus[1]}). A scream. Then silence.`;
        ng.percepts = [...(ng.percepts || []), "Scream"];
        const { steps, trace } = inferSafeCells(ng);
        setTotalSteps((prev) => prev + steps);
        setResTrace(trace);
        setKbCount(ng.kb.clauseCount());
      } else {
        ng.message = `Arrow missed. Wumpus remains at large.`;
      }
      setG(ng);
    },
    [G],
  );

  // Keyboard
  useEffect(() => {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const handler = (e) => {
      if (map[e.key]) {
        e.preventDefault();
        applyMove(map[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [applyMove]);

  const statusClass = G?.win ? "win" : G?.gameOver ? "danger" : "";

  return (
    <div className="app-shell">
      <Header
        totalSteps={totalSteps}
        visitedCount={G?.visited?.length ?? 0}
        gameState={G}
      />

      <div className="ww-body">
        {/* ── Left: Controls ── */}
        <ControlPanel
          rows={rows}
          cols={cols}
          setRows={setRows}
          setCols={setCols}
          onStart={startGame}
          onMove={applyMove}
          onShoot={applyShoot}
          hasGame={!!G}
          gameOver={G?.gameOver ?? false}
        />

        {/* ── Centre: Game Grid ── */}
        <main className="ww-main">
          {!G ? (
            /* Splash */
            <div className="ww-splash">
              <div className="splash-kicker">
                Vol. I &mdash; Artificial Intelligence &mdash; Cave Navigation
              </div>

              <h2 className="splash-headline">
                Wumpus
                <br />
                <em>Logic</em>
                <br />
                Agent
              </h2>

              <p className="splash-deck">
                A <strong>Knowledge-Based Agent</strong> navigates a
                procedurally-generated cave using{" "}
                <strong>Propositional Logic</strong> and a hand-coded
                <strong> Resolution Refutation</strong> engine to deduce safe
                cells before each move — no heuristics, no ML.
              </p>

              <div className="splash-cta">
                <button className="btn-splash" onClick={startGame}>
                  Initialise Agent
                </button>
                <span className="splash-hint">
                  configure grid dimensions in the left panel
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Status */}
              <div className={`status-bar ${statusClass}`}>
                <div className="status-label">
                  {G.win
                    ? "Episode Result — Success"
                    : G.gameOver
                      ? "Episode Result — Terminated"
                      : "Agent Log"}
                </div>
                <div className="status-msg">{G.message}</div>
              </div>

              {/* Grid */}
              <GameGrid G={G} />
            </>
          )}
        </main>

        {/* ── Right: Metrics + Trace ── */}
        <aside className="ww-right">
          <MetricsDashboard
            G={G}
            totalSteps={totalSteps}
            kbClauseCount={kbCount}
          />
          {G && <ResolutionTrace trace={resTrace} kbClauseCount={kbCount} />}
        </aside>
      </div>
    </div>
  );
}
