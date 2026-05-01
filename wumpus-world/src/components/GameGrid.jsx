import { useEffect, useRef } from 'react';

function getCellClass(r, c, G) {
  const [ar, ac] = G.agent;
  if (ar === r && ac === c) return 'agent';
  if (G.confirmedHazards.some(h => h[0] === r && h[1] === c)) return 'hazard';
  if (G.gameOver) {
    if (G.pits.some(p => p[0] === r && p[1] === c)) return 'pit';
    if (G.wumpus[0] === r && G.wumpus[1] === c) return 'wumpus';
  }
  if (G.visited.some(v => v[0] === r && v[1] === c)) return 'visited';
  if (G.safeCells.some(s => s[0] === r && s[1] === c)) return 'safe';
  return '';
}

// Typography labels instead of emoji icons
function getCellContent(r, c, G) {
  const [ar, ac] = G.agent;

  if (ar === r && ac === c) return { main: 'AGT', sub: 'agent' };

  if (G.confirmedHazards.some(h => h[0] === r && h[1] === c)) {
    const isW = G.wumpus[0] === r && G.wumpus[1] === c;
    return { main: isW ? 'WMP' : 'PIT', sub: isW ? 'dead' : 'hazard' };
  }

  if (G.gameOver) {
    if (G.pits.some(p => p[0] === r && p[1] === c)) return { main: 'PIT', sub: null };
    if (G.wumpus[0] === r && G.wumpus[1] === c)     return { main: 'WMP', sub: G.wumpusAlive ? 'wumpus' : 'dead' };
    if (G.gold[0] === r && G.gold[1] === c && !G.hasGold) return { main: 'GLD', sub: 'gold' };
  }

  if (G.visited.some(v => v[0] === r && v[1] === c)) {
    if (G.gold[0] === r && G.gold[1] === c && !G.hasGold) return { main: 'GLD', sub: 'gold' };
    return { main: null, sub: 'clear' };
  }

  if (G.safeCells.some(s => s[0] === r && s[1] === c)) return { main: null, sub: 'safe' };

  return { main: null, sub: null };
}

export default function GameGrid({ G }) {
  const prevAgent = useRef(null);
  const gridRef = useRef(null);

  // Trigger bounce on agent cell
  useEffect(() => {
    if (!G) return;
    const key = `${G.agent[0]}_${G.agent[1]}`;
    if (prevAgent.current !== key) {
      prevAgent.current = key;
      const el = gridRef.current?.querySelector(`[data-cell="${key}"]`);
      if (el) {
        el.classList.remove('popped');
        void el.offsetWidth;
        el.classList.add('popped');
        setTimeout(() => el.classList.remove('popped'), 350);
      }
    }
  }, [G?.agent]);

  if (!G) return null;

  return (
    <div>
      <div className="grid-outer" ref={gridRef}>
        {Array.from({ length: G.rows }, (_, r) => (
          <div className="grid-row-wrap" key={r}>
            {Array.from({ length: G.cols }, (_, c) => {
              const cls = getCellClass(r, c, G);
              const { main, sub } = getCellContent(r, c, G);
              return (
                <div
                  key={c}
                  className={`cell ${cls}`}
                  data-cell={`${r}_${c}`}
                  title={`(${r}, ${c})`}
                >
                  {main && <span className="cell-label">{main}</span>}
                  {sub  && <span className="cell-sub">{sub}</span>}
                  <span className="cell-coord">{r},{c}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="grid-axis-label">
        origin (0,0) top-left &mdash; cells proven safe by KB rendered with green left rule
      </p>
    </div>
  );
}
