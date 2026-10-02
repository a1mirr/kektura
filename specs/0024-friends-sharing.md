# 0024: Sharing progress with friends

Status: Accepted
Owner code: `src/lib/friends.ts`, `src/app/[locale]/friends/*`, `supabase/migrations/0009_friends.sql`

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
  fallback if missing), and is editable in settings. It is stored in `profiles` and visible only to the
  user and their friends.

### Connecting

- **AC-2**: A signed-in user has one permanent invite link `/friends/invite/<token>`. The token is random
  with at least 128 bits, and its format is enforced by the database. The link does not expire and can be
  used by any number of people to send friendship requests. There is no search by name or email: nobody
  can find a stranger. A user can regenerate their link, which immediately invalidates the old token.
- **AC-3**: Opening an invite link signed out sends the visitor through sign-in and back to the link.
  Signed in, the page shows the inviter's display name and a "Send request" button. Opening an unknown
  or revoked token shows a "this link is not valid" page. Opening your own link says it is yours.
  Sending a request when already friends or if a request is already pending says so. The `send_request`
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
  Asking for a user who is not a friend returns the same empty answer as asking for an unknown id.
  Updating or deleting a friendship is strictly handled by `security definer` RPCs to prevent one-sided
  re-pointing or bypassing rules, and direct UPDATE/DELETE policies are omitted or heavily restricted.
  The `friendships` table must have an index on `friend_id` to support querying requests.
- **AC-13**: Regenerating an invite, sending a request, and approving/ignoring are rate limited per user. There is no limit on the number of friends.
- **AC-14**: The actions (create invite, send request, approve, ignore, remove, set sharing, set display name)
  never throw: they return an `ActionResult` and log a failure as one `[friends]` line without tokens,
  names or user ids (spec 0008's rules).

### Feature flag and texts

- **AC-15**: While the flag `friends` is off for the viewer, `/friends` and `/friends/invite/*` answer 404,
  the actions return `disabled` and no link to them is shown (spec 0023 AC-5).
- **AC-16**: Every user-visible string exists in `ru`, `en` and `hu`. The About page (spec 0015) tells
  what friends can see and how to stop it, and the changelog gets an entry when the flag goes on for
  everyone.

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
| AC-1, AC-2, AC-13 | planned: `src/lib/friends.test.ts` |
| AC-8 | planned: `src/lib/friends.test.ts` (a friend's numbers equal the dashboard's for the same stamps) |
| AC-3 to AC-7, AC-9 to AC-11, AC-15 | planned: `e2e/friends.spec.ts` (two signed-in users) |
| AC-12 | planned: `tests/friends-migration.test.ts` and the Supabase advisors after applying |
| AC-14 | planned: `src/app/[locale]/friends/actions.test.ts` |
| AC-16 | planned: `tests/messages.test.ts`, manual: About page and changelog |
