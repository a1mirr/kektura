# Tasks

A task is one piece of work: a feature to build, a refactor, a CI change, a rename, a data update. It says what is
being done and why, which specs it touches, and what is done when. It never says how the product behaves: that
is what the **specs** are for ([`specs/README.md`](../specs/README.md), [0034](../specs/0034-specs-and-tasks.md)).
A finished task stays as history and is not updated when behaviour changes later.

- Copy [`_template.md`](_template.md) to `tasks/NNNN-short-slug.md`. The number is the next one after the
  highest in `specs/` **and** `tasks/` (one sequence over both folders), status `Open`. Written in English.
- A task has no acceptance criteria. If you are writing "given X, when Y, then Z", it belongs in a spec.
- A feature or behaviour change edits or drafts the spec first, then gets its task. A refactor, CI or deploy
  change or data update is only a task. A trivial fix needs no task.
- Statuses: `Open`, `In progress`, `Done`, `Dropped` (say why in Notes).
- Before a task is `Done` its **Spec changes** section says what changed in the specs, and those specs mirror the
  code as built.
- A migration is named after the number of the task that adds it.

## Index

| Task | What | Status |
| --- | --- | --- |
| [0035](0035-specs-and-tasks.md) | Introduce tasks next to specs | Done |
| [0036](0036-reshape-specs.md) | Turn the existing specs into area specs and tasks | Open |
