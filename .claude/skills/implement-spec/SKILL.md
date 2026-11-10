---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Implementation runs through the saved workflow **`implement-tickets`** (`.claude/workflows/implement-tickets.js`): it walks the task graph frontier by frontier, gives each ticket its own implementer in an isolated git worktree (`isolation: 'worktree'`), and merges each finished ticket into the integration branch. Do not spawn sub-agents with the Agent tool: the workflows named here are the only fan-out.

Communication to and from the workflow's agents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

## Steps

1. Read the spec and tickets to understand the task graph.

2. Pick a notes directory: an absolute path outside the repo (for example under the OS temp directory). Any exploration required by the tickets - relevant codebase files or external documentation - is the first phase of the `implement-tickets` workflow: one exploration agent saves its markdown notes there, accessible by every later agent. This lets the implementers focus on implementation rather than exploration. If the tickets need no exploration, pass `"explore": false` in step 4.

3. Create the integration branch and check it out at the repo root with a clean working tree (the workflow requires both). If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

4. Call the Workflow tool with `name: "implement-tickets"` and these `args`:

   ```json
   {
     "spec": "<spec reference: issue number, URL or path>",
     "integrationBranch": "<integration branch>",
     "tickets": [
       { "id": "<ticket id>", "title": "<title>", "blockedBy": ["<ticket id>", ...] }
     ],
     "notesDir": "<absolute path of the notes directory from step 2>"
   }
   ```

   Pass `tickets` as a real JSON array carrying every open ticket of the spec with its blocking edges; the workflow computes the frontier from `blockedBy`. `blockedBy` may only name ids present in `tickets`: drop edges to tickets already closed. Inside the workflow, each ticket's implementer, in its own worktree on its own branch:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done

5. Once an implementer completes, the workflow merges its work to the integration branch with a merger agent.

6. When a merge changes the **frontier** of available tickets, the workflow starts implementers for the newly unblocked tickets. This allows for maximum concurrency. The workflow returns `{ integrationBranch, waves, allMerged, tickets }`, with one entry per ticket carrying its state. If `allMerged` is false, resolve the cause and call the workflow again with the remaining tickets and `"explore": false`.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. If the spec's work is a feature under `hackai/`, make sure the review included the campus compatibility check: the `mergeable-check` workflow with `args: { "feature": "<feature>" }` returning `mergeable: true`, or the `campus-feature` skill's checklist. Fix all issues raised by both, yourself, on the integration branch, in a single pass.

8. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up any ticket worktrees and branches the workflow left behind (`git worktree list`).
