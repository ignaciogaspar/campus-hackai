# Design It Twice

When the user wants to explore alternative interfaces for a chosen deepening candidate, use the saved workflow **`design-it-twice`** (`.claude/workflows/design-it-twice.js`), which runs the designers in parallel. Do not spawn sub-agents with the Agent tool. Based on "Design It Twice" (Ousterhout): your first idea is unlikely to be the best.

Uses the vocabulary in [SKILL.md](SKILL.md): **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before running the workflow, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch to ground the constraints, not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the workflow's designers work in parallel.

### 2. Run the `design-it-twice` workflow

Call the Workflow tool with `name: "design-it-twice"` and these `args`:

```json
{
  "brief": "<technical brief>",
  "constraints": ["<design constraint 1>", "<design constraint 2>", "<design constraint 3>"]
}
```

The workflow runs one designer per entry in `constraints` (3 or more, passed as a real JSON array; omitted, it uses the first three below). Each must produce a **radically different** interface for the deepened module. It returns `{ designs, comparison }`.

`brief` is a separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing problem-space explanation in Step 1. Give each designer a different design constraint:

- Agent 1: "Minimize the interface: aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility: support many use cases and extension."
- Agent 3: "Optimise for the most common caller: make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include both [SKILL.md](SKILL.md) vocabulary and GLOSSARY.md vocabulary in `brief` so each designer names things consistently with the architecture language and the project's domain language.

Each designer outputs:

1. Interface (types, methods, params, plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs: where leverage is high, where it's thin

### 3. Present and compare

Present the designs the workflow returned sequentially so the user can absorb each one, then compare them in prose, using the workflow's comparison as input rather than as the verdict. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated: the user wants a strong read, not a menu.
