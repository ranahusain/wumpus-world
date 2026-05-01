from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import json
from itertools import product as iproduct

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
#  Propositional Logic & Resolution Engine
# ─────────────────────────────────────────────


class Literal:
    def __init__(self, name, negated=False):
        self.name = name
        self.negated = negated

    def negate(self):
        return Literal(self.name, not self.negated)

    def __eq__(self, other):
        return self.name == other.name and self.negated == other.negated

    def __hash__(self):
        return hash((self.name, self.negated))

    def __repr__(self):
        return f"{'¬' if self.negated else ''}{self.name}"


class Clause:
    """A disjunction of literals (CNF clause)."""

    def __init__(self, literals):
        self.literals = frozenset(literals)

    def is_empty(self):
        return len(self.literals) == 0

    def __eq__(self, other):
        return self.literals == other.literals

    def __hash__(self):
        return hash(self.literals)

    def __repr__(self):
        if self.is_empty():
            return "⊥"
        return " ∨ ".join(str(l) for l in self.literals)


def resolve(c1, c2):
    """
    Resolution rule: given two clauses, find a literal that appears
    positively in one and negatively in the other. Return the resolvent.
    Returns list of new clauses (may be empty if no resolution possible).
    """
    resolvents = []
    for lit in c1.literals:
        complement = lit.negate()
        if complement in c2.literals:
            new_lits = (c1.literals - {lit}) | (c2.literals - {complement})
            resolvents.append(Clause(new_lits))
    return resolvents


def resolution_refutation(kb_clauses, query_literal):
    """
    Resolution Refutation: prove that query_literal follows from KB.
    We negate the query and try to derive the empty clause (contradiction).
    Returns (proved: bool, steps: int, trace: list)
    """
    # Negate the query and add to KB
    negated_query = Clause([query_literal.negate()])
    clauses = set(kb_clauses) | {negated_query}
    steps = 0
    trace = []
    new_clauses = set()

    while True:
        pairs = [(c1, c2) for c1 in clauses for c2 in clauses if c1 != c2]
        found_new = False

        for (c1, c2) in pairs:
            resolvents = resolve(c1, c2)
            for r in resolvents:
                steps += 1
                trace.append({
                    "step": steps,
                    "c1": str(c1),
                    "c2": str(c2),
                    "resolvent": str(r)
                })
                if r.is_empty():
                    return True, steps, trace
                if r not in clauses:
                    new_clauses.add(r)
                    found_new = True

        if not found_new:
            return False, steps, trace

        clauses |= new_clauses
        new_clauses = set()

        # Safety cap
        if steps > 2000:
            return False, steps, trace


# ─────────────────────────────────────────────
#  Knowledge Base
# ─────────────────────────────────────────────

class KnowledgeBase:
    def __init__(self):
        self.clauses = set()
        self.facts = {}   # variable_name -> True/False

    def tell(self, clause):
        self.clauses.add(clause)

    def tell_fact(self, name, value):
        """Assert a ground fact."""
        self.facts[name] = value
        if value:
            self.tell(Clause([Literal(name, negated=False)]))
        else:
            self.tell(Clause([Literal(name, negated=True)]))

    def ask_safe(self, row, col):
        """
        Ask: is cell (row,col) safe? i.e., no pit AND no wumpus.
        Returns (is_safe, inference_steps, trace)
        """
        pit_var = f"P_{row}_{col}"
        wumpus_var = f"W_{row}_{col}"

        # Check if already known unsafe
        if self.facts.get(pit_var) or self.facts.get(wumpus_var):
            return False, 0, []

        # Prove ¬P AND ¬W via resolution
        total_steps = 0
        full_trace = []

        # we want to prove ¬P, so negate = prove P leads to contradiction
        no_pit_lit = Literal(pit_var, negated=False)
        proved_no_pit, steps1, trace1 = resolution_refutation(
            self.clauses, Literal(pit_var, negated=True))
        total_steps += steps1
        full_trace.extend(trace1)

        proved_no_wumpus, steps2, trace2 = resolution_refutation(
            self.clauses, Literal(wumpus_var, negated=True))
        total_steps += steps2
        full_trace.extend(trace2)

        is_safe = proved_no_pit and proved_no_wumpus
        return is_safe, total_steps, full_trace

    def add_breeze_rule(self, row, col, rows, cols):
        """
        B_{r,c} => P_{r-1,c} ∨ P_{r+1,c} ∨ P_{r,c-1} ∨ P_{r,c+1}
        In CNF: ¬B_{r,c} ∨ P_{r-1,c} ∨ ...
        """
        b_var = f"B_{row}_{col}"
        neighbors = get_neighbors(row, col, rows, cols)
        pit_lits = [Literal(f"P_{nr}_{nc}") for nr, nc in neighbors]
        self.tell(Clause([Literal(b_var, negated=True)] + pit_lits))

    def add_stench_rule(self, row, col, rows, cols):
        s_var = f"S_{row}_{col}"
        neighbors = get_neighbors(row, col, rows, cols)
        wumpus_lits = [Literal(f"W_{nr}_{nc}") for nr, nc in neighbors]
        self.tell(Clause([Literal(s_var, negated=True)] + wumpus_lits))

    def add_no_breeze_constraints(self, row, col, rows, cols):
        """
        No breeze => no pit in neighbors: ¬P_{nr,nc} for each neighbor
        """
        for nr, nc in get_neighbors(row, col, rows, cols):
            self.tell_fact(f"P_{nr}_{nc}", False)

    def add_no_stench_constraints(self, row, col, rows, cols):
        for nr, nc in get_neighbors(row, col, rows, cols):
            self.tell_fact(f"W_{nr}_{nc}", False)


def get_neighbors(row, col, rows, cols):
    candidates = [(row-1, col), (row+1, col), (row, col-1), (row, col+1)]
    return [(r, c) for r, c in candidates if 0 <= r < rows and 0 <= c < cols]


# ─────────────────────────────────────────────
#  Game State
# ─────────────────────────────────────────────

games = {}  # session_id -> game state


def create_game(rows, cols, num_pits=None):
    if num_pits is None:
        num_pits = max(1, (rows * cols) // 6)

    cells = [(r, c) for r in range(rows) for c in range(cols)]
    start = (0, 0)
    non_start = [cell for cell in cells if cell != start]

    pits = random.sample(non_start, min(num_pits, len(non_start) - 1))
    remaining = [cell for cell in non_start if cell not in pits]

    gold_pos = random.choice(remaining)
    remaining2 = [cell for cell in remaining if cell != gold_pos]
    wumpus_pos = random.choice(remaining2)

    kb = KnowledgeBase()

    # Structural axioms: exactly one wumpus
    wumpus_lits = [Literal(f"W_{r}_{c}") for r, c in cells]
    kb.tell(Clause(wumpus_lits))  # at least one wumpus somewhere

    # Start cell is safe
    kb.tell_fact(f"P_0_0", False)
    kb.tell_fact(f"W_0_0", False)

    # Add breeze/stench rules for all cells
    for r, c in cells:
        kb.add_breeze_rule(r, c, rows, cols)
        kb.add_stench_rule(r, c, rows, cols)

    state = {
        "rows": rows,
        "cols": cols,
        "pits": pits,
        "wumpus": wumpus_pos,
        "gold": gold_pos,
        "agent": [0, 0],
        "visited": [[0, 0]],
        "safe_cells": [[0, 0]],
        "confirmed_hazards": [],
        "has_gold": False,
        "game_over": False,
        "win": False,
        "kb": kb,
        "total_inference_steps": 0,
        "percepts": [],
        "message": "Agent starts at (0,0). Exploring...",
        "resolution_trace": [],
        "wumpus_alive": True,
    }

    # Process starting cell percepts
    _process_percepts(state)
    return state


def _process_percepts(state):
    r, c = state["agent"]
    rows, cols = state["rows"], state["cols"]
    kb = state["kb"]
    percepts = []

    has_breeze = any((r, c) in get_neighbors(pr, pc, rows, cols) + [(pr, pc)]
                     for pr, pc in state["pits"]
                     if (pr, pc) in [n for n in get_neighbors(r, c, rows, cols)] or (pr == r and pc == c))

    # Proper breeze check: adjacent to any pit?
    has_breeze = any((nr, nc) in state["pits"]
                     for nr, nc in get_neighbors(r, c, rows, cols))
    has_stench = any((nr, nc) == state["wumpus"] for nr, nc in get_neighbors(
        r, c, rows, cols)) and state["wumpus_alive"]

    b_var = f"B_{r}_{c}"
    s_var = f"S_{r}_{c}"

    if has_breeze:
        percepts.append("Breeze")
        kb.tell_fact(b_var, True)
        kb.tell(Clause([Literal(f"B_{r}_{c}")]))
    else:
        percepts.append("No Breeze")
        kb.tell_fact(b_var, False)
        kb.add_no_breeze_constraints(r, c, rows, cols)

    if has_stench:
        percepts.append("Stench")
        kb.tell_fact(s_var, True)
        kb.tell(Clause([Literal(f"S_{r}_{c}")]))
    else:
        percepts.append("No Stench")
        kb.tell_fact(s_var, False)
        kb.add_no_stench_constraints(r, c, rows, cols)

    if [r, c] == list(state["gold"]) or (r, c) == state["gold"]:
        percepts.append("Glitter!")

    state["percepts"] = percepts


def _infer_safe_cells(state):
    rows, cols = state["rows"], state["cols"]
    kb = state["kb"]
    new_safe = []
    total_steps = 0
    trace = []

    for r in range(rows):
        for c in range(cols):
            cell = [r, c]
            if cell in state["visited"]:
                continue
            is_safe, steps, cell_trace = kb.ask_safe(r, c)
            total_steps += steps
            trace.extend(cell_trace)
            if is_safe and cell not in state["safe_cells"]:
                state["safe_cells"].append(cell)
                new_safe.append(cell)

    state["total_inference_steps"] += total_steps
    state["resolution_trace"] = trace[-20:]  # keep last 20 steps
    return new_safe


def serialize_state(state):
    """Convert game state to JSON-safe dict."""
    return {
        "rows": state["rows"],
        "cols": state["cols"],
        "agent": state["agent"],
        "visited": state["visited"],
        "safe_cells": state["safe_cells"],
        "confirmed_hazards": state["confirmed_hazards"],
        "has_gold": state["has_gold"],
        "game_over": state["game_over"],
        "win": state["win"],
        "percepts": state["percepts"],
        "message": state["message"],
        "total_inference_steps": state["total_inference_steps"],
        "resolution_trace": state["resolution_trace"],
        "wumpus_alive": state["wumpus_alive"],
        # Reveal actual positions on game over
        "pits": state["pits"] if state["game_over"] else [],
        "wumpus": list(state["wumpus"]) if state["game_over"] else [],
        "gold": list(state["gold"]),
    }


# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────

@app.route("/api/new_game", methods=["POST"])
def new_game():
    data = request.json
    rows = max(4, min(10, int(data.get("rows", 5))))
    cols = max(4, min(10, int(data.get("cols", 5))))
    session_id = data.get("session_id", "default")

    state = create_game(rows, cols)
    _infer_safe_cells(state)
    games[session_id] = state

    return jsonify({"session_id": session_id, **serialize_state(state)})


@app.route("/api/move", methods=["POST"])
def move():
    data = request.json
    session_id = data.get("session_id", "default")
    direction = data.get("direction")  # up/down/left/right

    if session_id not in games:
        return jsonify({"error": "No game found"}), 404

    state = games[session_id]
    if state["game_over"]:
        return jsonify(serialize_state(state))

    r, c = state["agent"]
    dr, dc = {"up": (-1, 0), "down": (1, 0), "left": (0, -1),
              "right": (0, 1)}.get(direction, (0, 0))
    nr, nc = r + dr, c + dc

    if not (0 <= nr < state["rows"] and 0 <= nc < state["cols"]):
        state["message"] = "Cannot move outside the grid!"
        return jsonify(serialize_state(state))

    state["agent"] = [nr, nc]
    if [nr, nc] not in state["visited"]:
        state["visited"].append([nr, nc])

    # Check hazards
    if [nr, nc] in [[p[0], p[1]] for p in state["pits"]] or (nr, nc) in state["pits"]:
        state["game_over"] = True
        state["win"] = False
        state["confirmed_hazards"].append([nr, nc])
        state["message"] = f"💀 Agent fell into a pit at ({nr},{nc})! Game Over."
        state["percepts"] = ["FELL IN PIT"]
        return jsonify(serialize_state(state))

    if (nr, nc) == state["wumpus"] and state["wumpus_alive"]:
        state["game_over"] = True
        state["win"] = False
        state["confirmed_hazards"].append([nr, nc])
        state["message"] = f"💀 Agent was eaten by the Wumpus at ({nr},{nc})! Game Over."
        state["percepts"] = ["EATEN BY WUMPUS"]
        return jsonify(serialize_state(state))

    _process_percepts(state)
    _infer_safe_cells(state)

    # Check gold
    if (nr, nc) == state["gold"] or [nr, nc] == list(state["gold"]):
        state["has_gold"] = True
        state["message"] = f"✨ Gold found at ({nr},{nc})! Head back to (0,0) to win!"
        if "Glitter!" not in state["percepts"]:
            state["percepts"].append("Glitter!")
    else:
        state["message"] = f"Agent moved to ({nr},{nc}). Percepts: {', '.join(state['percepts'])}"

    if state["has_gold"] and state["agent"] == [0, 0]:
        state["game_over"] = True
        state["win"] = True
        state["message"] = "🏆 Agent returned with the gold! YOU WIN!"

    return jsonify(serialize_state(state))


@app.route("/api/shoot", methods=["POST"])
def shoot():
    """Shoot arrow in a direction."""
    data = request.json
    session_id = data.get("session_id", "default")
    direction = data.get("direction")

    if session_id not in games:
        return jsonify({"error": "No game found"}), 404

    state = games[session_id]
    if state["game_over"]:
        return jsonify(serialize_state(state))

    r, c = state["agent"]
    dr, dc = {"up": (-1, 0), "down": (1, 0), "left": (0, -1),
              "right": (0, 1)}.get(direction, (0, 0))

    # Arrow travels in direction until wall
    ar, ac = r + dr, c + dc
    hit_wumpus = False
    while 0 <= ar < state["rows"] and 0 <= ac < state["cols"]:
        if (ar, ac) == state["wumpus"] and state["wumpus_alive"]:
            hit_wumpus = True
            break
        ar, ac = ar + dr, ac + dc

    if hit_wumpus:
        state["wumpus_alive"] = False
        state["confirmed_hazards"].append(list(state["wumpus"]))
        state["kb"].tell_fact(
            f"W_{state['wumpus'][0]}_{state['wumpus'][1]}", False)
        state["message"] = f"🏹 Arrow hit! Wumpus is dead! Screech heard!"
        state["percepts"] = state["percepts"] + ["Scream! Wumpus Killed!"]
    else:
        state["message"] = "🏹 Arrow missed..."

    _infer_safe_cells(state)
    return jsonify(serialize_state(state))


@app.route("/api/state", methods=["GET"])
def get_state():
    session_id = request.args.get("session_id", "default")
    if session_id not in games:
        return jsonify({"error": "No game found"}), 404
    return jsonify(serialize_state(games[session_id]))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
