import { useState } from 'react';

export default function ResolutionTrace({ trace, kbClauseCount }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      {/* ── Resolution Trace ── */}
      <div className="panel-block">
        <div className="trace-header">
          <span className="panel-heading" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            Resolution Trace
          </span>
          <button className="btn-toggle" onClick={() => setVisible(v => !v)}>
            {visible ? 'collapse' : 'expand'}
          </button>
        </div>

        {visible && (
          <div className="trace-scroll" style={{ marginTop: 10 }}>
            {trace.length ? trace.slice(-12).map((s, i) => (
              <div className="trace-card" key={i}>
                <div className="trace-num">Step {s.step}</div>
                <div className="trace-clause">C₁: {s.c1}</div>
                <div className="trace-clause">C₂: {s.c2}</div>
                <div className="trace-result">→ {s.resolvent}</div>
              </div>
            )) : (
              <p className="kb-blurb" style={{ marginTop: 0 }}>No resolution steps yet. Move the agent to trigger inference.</p>
            )}
          </div>
        )}
      </div>

      {/* ── KB Summary ── */}
      <div className="panel-block">
        <div className="panel-heading">Knowledge Base</div>
        <p className="kb-blurb">
          The KB currently holds <strong>{kbClauseCount} CNF clauses</strong>. Each cell visit
          asserts breeze &amp; stench facts, which the resolution engine uses to
          derive <strong>¬P ∧ ¬W</strong> for candidate cells.
        </p>
      </div>

      {/* ── How It Works ── */}
      <div className="panel-block" style={{ marginTop: 'auto' }}>
        <div className="panel-heading">How It Works</div>
        <p className="howto">
          When breeze is detected at <em>(r,c)</em>, the KB adds:<br />
          <code>¬B(r,c) ∨ P(adj₁) ∨ P(adj₂)…</code><br /><br />
          To prove a cell safe, the engine negates the query—adding
          <code>P(r,c)</code>—then resolves clause pairs until the empty
          clause <code>⊥</code> is derived (contradiction), proving <strong>¬P</strong>.<br /><br />
          Green-ruled cells are <em>logically guaranteed</em> safe by the inference engine,
          not heuristically estimated.
        </p>
      </div>
    </>
  );
}
