# 0024: Sharing progress with friends

Status: Done
Owner code: `src/lib/friends.ts`, `src/lib/friends-flag.ts`, `src/lib/friends-input.ts`, `src/app/[locale]/(pages)/friends/*`,
`supabase/migrations/0024_friends.sql`

## Goal

Hikers walk the Kéktúra in company or compete quietly. Let a signed-in user connect with a friend who also
has an account, and let each see the other's progress inside the site: how many of the 161 places, how many
kilometres, which stages. Nothing is public: only people you accepted can see anything, and you can stop
sharing at any moment. Ships behind the feature flag `friends` (spec 0023).

## Behaviour

### Identity

- **AC-1**: Friends see a display name, never an email address. Each user has a display name of 1 to 40
  characters (trimmed, no control characters, enforced by a database constraint). It is populated automatically
  via a database trigger on account creation, defaulting to the first name from the Google account (or a
  fallback if the name is missing or empty), and is editable on the Friends page. It is stored in `profiles`
  and visible only to the user, their friends and pending requesters, and (AC-3) to a signed-in holder of
  their invite link. Whatever the Google profile holds, creating the account never fails because of the name.

### Connecting

- **AC-2**: A signed-in user has one permanent invite link `/friends/invite/<token>`. The token is random
  with at least 128 bits, and its format is enforced by the database. The link does not expire and can be
  used by any number of people to send friendship requests. There is no search by name or email: nobody
  can find a stranger. A user can regenerate their link, which immediately invalidates the old token.
- **AC-3**: Opening an invite link signed out sends the visitor through sign-in and back to the link; the
  page before sign-in reveals neither the owner nor whether the link is valid. Signed in, the page shows the
  inviter's display name and a "Send request" button. After a request is sent the Friends page says so
  ("Request sent"), since the requester has nothing else to see until the inviter approves. Opening an unknown
  or revoked token shows a "this link is not valid" page. Opening your own link says it is yours.
  Sending a request when already friends, when you already asked, or when that person already asked you
  (approve it on `/friends`) says so. The `send_request`
  action must return a clear status so the app can distinguish these outcomes.
- **AC-4**: Sending a request creates a pending friendship that only the inviter sees. The inviter sees their
  pending requests on `/friends` and can click "Approve" or "Ignore".
- **AC-5**: Approving a request creates the full bidirectional friendship that both sides see, and both
  sides start sharing their progress summary immediately. Ignoring removes the request silently.
- **AC-6**: The inviter can see their current invite link on `/friends` and can regenerate it to prevent
  further uses of the old link. Removed friends cannot bypass the approval step if they use the link again.

### What a friend sees

- **AC-7**: `/friends` lists the friends with, for each, the summary: official places stamped of 161, km
  walked, stages completed and the display name. Selecting a friend opens a read-only page with their
  stage-by-stage progress. It shows no stamp dates, no notes and no extra stamps.
- **AC-8**: A friend's numbers are computed by the same functions as the owner's dashboard
  (`src/lib/progress.ts`), from the friend's stamped place ids, so the two never disagree.
- **AC-9**: Each user controls their side: per friend, a switch "show my progress to this friend". When it
  is off, that friend sees "not sharing" and no numbers. The switch is independent in each direction.

### Ending it

- **AC-10**: Either side can remove the friendship. Access ends at once in both directions, the other side
  is not notified and simply no longer sees the person. A removed friend can only come back through a new
  invite.
- **AC-11**: Deleting the account (spec 0014) removes the user's profile, invites and friendships, and the
  former friends' lists stop showing them.

### Security

- **AC-12**: `profiles` and `friendships` have row level security enabled. A user's
  stamps stay unreadable to everyone but themselves (spec 0002); a friend's progress is read only through
  `security definer` functions (empty `search_path`, executable by `authenticated` only, revoked from `anon`)
  that check the friendship and the friend's sharing switch, and return nothing else than the stamped place ids.
  Someone who is not an accepted friend, or whose sharing switch towards me is off, simply does not appear in
  the answer: there is no way to ask about a particular user.
  Nobody writes `profiles` or `friendships` directly: creating, approving, ignoring, removing and switching
  a friendship, changing the display name and regenerating the invite are `security definer` functions, and
  the tables have no insert, update or delete privilege or policy for `anon` or `authenticated` (otherwise
  anyone could make themselves an accepted friend). The invite token is not readable through the table: its
  owner gets it from `get_my_invite_token()`, so friends and pending requesters never see it, and tokens are
  only ever generated by the database. A pair of users has at most one friendship, whoever asked first.
  `get_inviter_info` answers only signed-in callers and returns no user id. The `friendships` table has an
  index on `friend_id` to support querying requests.
- **AC-13**: Regenerating an invite, sending a request, and approving/ignoring are rate limited per user (30
  per hour, one shared budget) in the app's actions. The database functions behind them are not limited
  beyond the rules of the data itself (one friendship per pair, one invite token per user), so a client that
  bypasses the app can repeat a call but not gain anything by it. There is no limit on the number of friends.
- **AC-14**: The actions (regenerate invite, send request, approve, ignore, remove, set sharing, set display name)
  never throw: they return an `ActionResult` (`unauthorized` when signed out, `failed` for anything else,
  including a network error) and log a failure as one `[friends]` line without tokens, names or user ids
  (spec 0008's rules).

### Feature flag and texts

- **AC-15**: While the flag `friends` is off, `/friends`, `/friends/<id>` and `/friends/invite/*` answer 404,
  the actions return `disabled` without touching the database and no link to them is shown (the dashboard
  link, the About page paragraph). Until the mechanism of spec 0023 exists the flag is the server environment
  variable `FF_FRIENDS=1`: read on every request (a restart of the server applies a change, no rebuild: the
  pages that would otherwise be static opt into per-request rendering), off
  unless set, the same for every viewer. Spec 0023 replaces it with the per-user flag; then this AC says "off
  for the viewer" (0023 AC-5).
- **AC-16**: Every user-visible string exists in `ru`, `en` and `hu`. The About page (spec 0015) tells
  what friends can see and how to stop it (only while the flag is on: with it off the page must not mention
  a page that answers 404), and the changelog gets an entry when the flag goes on for everyone.

## Out of scope

Public profile pages or links viewable without an account; groups, leaderboards and rankings; chat,
comments and reactions; notifications by email or push; a feed of friends' latest stamps; finding
people by name or email; importing contacts; showing a friend's map, dates or extra stamps; sharing a
route plan.


## Notes

- A friend's progress is computed from place ids and not from stored totals, so a change in the progress
  rules (spec 0001) automatically changes what friends see.
- Account deletion already cascades through `auth.users` (spec 0014): the new tables reference it with
  `on delete cascade`, and the index advisor rule from spec 0007 applies to their foreign keys.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `src/lib/friends.test.ts` (validation), `tests/friends-migration.test.ts` (default name, fallback, constraint), `e2e/friends.spec.ts` (edit) |
| AC-2 | `tests/friends-migration.test.ts` (token format, regenerate), `e2e/friends.spec.ts` |
| AC-3 | `tests/friends-migration.test.ts` (`get_inviter_info`, own link), `e2e/friends.spec.ts` (signed out through sign-in and back, unknown, own, already pending) |
| AC-4, AC-5 | `tests/friends-migration.test.ts` (approval flow), `src/lib/friends.test.ts`, `e2e/friends.spec.ts` |
| AC-6 | `tests/friends-migration.test.ts` (a removed friend needs a new approval; friends never read the token) |
| AC-7 | `src/lib/friends.test.ts` (completed stages), `e2e/friends.spec.ts` (list, friend page, signed-out redirect) |
| AC-8 | `src/lib/friends.test.ts` (equal to `progress.ts`), `e2e/friends.spec.ts` (same numbers as the dashboard) |
| AC-9, AC-10 | `tests/friends-migration.test.ts`, `e2e/friends.spec.ts` |
| AC-11 | `e2e/friends.spec.ts` (delete the account, the friend's list is empty) |
| AC-12 | `tests/friends-migration.test.ts` (forged friendship, direct writes, token column, anon, the trigger function); Supabase advisors after applying |
| AC-13, AC-14 | `src/app/[locale]/(pages)/friends/actions.test.ts` (an action that fails is shown on the page: `e2e/friends.spec.ts`) |
| AC-15 | `src/lib/friends.test.ts` (flag), `actions.test.ts` (`disabled`); the start-up value, not the build, decides: manual (it needs two builds): build once without `FF_FRIENDS`, start with `FF_FRIENDS=1` (and the other way round): the dashboard link, `/friends`, `/friends/invite/<token>` and the About paragraph follow the start-up value (the E2E server runs with the flag on). Last checked: never recorded. |
| AC-16 | `tests/messages.test.ts`, `e2e/friends.spec.ts` (About paragraph); the changelog entry waits for the flag |
