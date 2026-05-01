export default function MetricsDashboard({ G, totalSteps, kbClauseCount }) {
  if (!G) return null;

  const percepts = G.percepts || [];

  function getPerceptClass(p) {
    if (p.toLowerCase().includes('breeze'))  return 'breeze';
    if (p.toLowerCase().includes('stench'))  return 'stench';
    if (p.toLowerCase().includes('glitter')) return 'glitter';
    if (p.toLowerCase().includes('pit') || p.toLowerCase().includes('eaten')) return 'danger';
    if (p.toLowerCase().includes('scream') || p.toLowerCase().includes('dead')) return 'good';
    return '';
  }

  return (
    <>
      {/* ── Live Metrics ── */}
      <div className="panel-block">
        <div className="panel-heading">Real-Time Metrics</div>

        <div className="metric-row">
          <span className="metric-key">Inference steps</span>
          <span className="metric-val accent">{totalSteps.toLocaleString()}</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">KB clauses</span>
          <span className="metric-val">{kbClauseCount}</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Cells visited</span>
          <span className="metric-val">{G.visited.length}</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Safe cells known</span>
          <span className="metric-val good">{G.safeCells.length}</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Hazards confirmed</span>
          <span className="metric-val accent">{G.confirmedHazards.length}</span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Gold retrieved</span>
          <span className={`metric-val ${G.hasGold ? 'good' : 'muted'}`}>
            {G.hasGold ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-key">Wumpus status</span>
          <span className={`metric-val ${G.wumpusAlive ? 'accent' : 'muted'}`}>
            {G.wumpusAlive ? 'Alive' : 'Dead'}
          </span>
        </div>
      </div>

      {/* ── Percepts ── */}
      <div className="panel-block">
        <div className="panel-heading">Active Percepts</div>
        <div className="percept-list">
          {percepts.length
            ? percepts.map((p, i) => (
                <span key={i} className={`percept-tag ${getPerceptClass(p)}`}>{p}</span>
              ))
            : <span className="t-mono" style={{ fontStyle: 'italic' }}>none active</span>
          }
        </div>
      </div>
    </>
  );
}
