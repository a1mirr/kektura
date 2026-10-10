// Kept apart from stop-check.mjs so that the decision is a pure function of the changed paths and a test can call it
// (the hook itself runs on import). Paths are repository-relative with forward slashes, as `git status --porcelain`
// prints them.

const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f) || f.startsWith("tests/") || f.startsWith("e2e/");
const isCode = (f) => /\.(ts|tsx)$/.test(f) && !isTest(f) && !f.endsWith(".types.ts");

/** App code: a non-test TypeScript file under src/ (generated `.types.ts` excluded). */
export const isAppCode = (f) => f.startsWith("src/") && isCode(f);

export const isUserVisible = (f) =>
  /^messages\/[^/]+\.json$/.test(f) ||
  (/^src\/app\/(.*\/)?(page|layout)\.tsx$/.test(f) && isCode(f)) ||
  (f.startsWith("src/components/") && isCode(f));

export const CHANGELOG = "src/content/changelog.ts";

// Work is usually committed before a turn ends, and a nudge that only saw the working tree never fired.
export const changedForNudge = (uncommitted, committed) => [...new Set([...uncommitted, ...committed])];

export function nudgeTargets(changed) {
  const specChanged = changed.some((f) => f.startsWith("specs/"));
  const changelogChanged = changed.includes(CHANGELOG);
  return {
    appCode: specChanged ? [] : changed.filter(isAppCode),
    userVisible: changelogChanged ? [] : changed.filter(isUserVisible),
  };
}

export function nudgeMessage(changed) {
  const { appCode, userVisible } = nudgeTargets(changed);
  const parts = [];
  if (appCode.length) {
    parts.push(
      `app code changed without a spec change:\n  ${appCode.join("\n  ")}\n\n` +
        "If behaviour changed: edit the spec that owns it in specs/ (acceptance criteria) so it mirrors the code as built, and the tests that cite it. " +
        "If not (refactor, copy or styling only), say so in one line and finish.",
    );
  }
  if (userVisible.length) {
    parts.push(
      `files users can see changed without a changelog entry:\n  ${userVisible.join("\n  ")}\n\n` +
        "If users can see the change: add or extend an entry in src/content/changelog.ts in every language (spec 0018 AC-7). " +
        "If not (internal), say so in one line and finish.",
    );
  }
  return parts.length ? `Checks pass, but ${parts.join("\n\nAnd ")}` : "";
}

export const nudgeKey = (scope, message) => `${scope}\n${message}`;

// The same question is not repeated every turn, but a new commit or a changed working tree is a new state: the same
// file names in another task are asked about again.
export function nudgeToAsk(changed, committed, lastAsked, scope) {
  const message = nudgeMessage(changedForNudge(changed, committed));
  return message && nudgeKey(scope, message) !== lastAsked ? message : "";
}
