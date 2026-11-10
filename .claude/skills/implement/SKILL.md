---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "code-review" to review the work.

If the work is a feature under `hackai/`, it is not done until it passes the campus compatibility checklist: call the Workflow tool with `name: "mergeable-check"` and `args: { "feature": "<feature>" }` (or, if the workflow is unavailable, call the Skill tool with "campus-feature" and walk its checklist), and fix what it reports until it returns `mergeable: true`. Skip this if `code-review` already ran it for the same feature and nothing changed since.

Commit your work to the current branch.
