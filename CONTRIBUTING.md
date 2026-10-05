# Contributing

Thanks for looking. A few things that make a contribution easy to take:

- **Start with an issue.** Describe the problem or the idea first, especially for anything that changes how the app
  behaves. Small fixes (a typo, a translation) can go straight to a pull request.
- **Specs describe behaviour.** What each area does is written as numbered acceptance criteria in
  [`specs/`](specs/README.md), and tests cite them (`describe("spec NNNN: …")`, `it("AC-n: …")`). A change in behaviour
  edits the owning spec and its tests in the same pull request.
- **Run the checks.** `npm run check` (typecheck, lint, unit tests) has to pass; CI also runs the end-to-end tests
  against a local Supabase. [`README.md`](README.md) explains how to start the app and the test server.
- **Every user-visible string** goes into every `messages/*.json` file (Hungarian, English, German, Russian), and a
  change users can see adds a changelog entry in `src/content/changelog.ts`.
- **Security problems** are not for public issues: see [`SECURITY.md`](SECURITY.md).

The pull request template asks for a "Reviewed commit" line that the maintainer's own review process fills in; as a
first-time contributor you can leave it, the maintainer completes it before merging.

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE) like the rest of the code.
