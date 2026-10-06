# 0024: Sharing progress with friends

Status: Done
Owner code: `src/lib/friends.ts`, `src/lib/friends-input.ts`, `src/lib/compare.ts`, `src/app/[locale]/(pages)/friends/*`,
`src/components/Friend*.tsx`, `src/components/Compare*.tsx`, `src/components/FlashMessage.tsx`, `supabase/migrations/0024_friends.sql`

## Goal

Hikers walk the Kéktúra in company or compete quietly. Let a signed-in user connect with a friend who also
has an account, and let each see the other's progress inside the site: how many of the 161 places, how many
kilometres, which stages. Nothing is public: only people you accepted can see anything, and you can stop
sharing at any moment. Ships behind the feature flag `friends` (AC-15).

## Behaviour

### Identity

- **AC-1**: Friends see a display name, never an email address. Each user has a display name of 1 to 40
  characters (trimmed, no control characters, enforced by a database constraint). It is populated automatically
  via a database trigger on account creation, defaulting to the first name from the Google account (or a
  fallback if the name is missing or empty), and is editable on the Friends page. It is stored in `profiles`
  and visible only to the user, their friends, the people who asked them and the people they asked, and (AC-3) to a
  signed-in holder of their invite link (the name only). Whatever the Google profile holds, creating the account never fails because of the name.

### Connecting

- **AC-2**: A signed-in user has one permanent invite link `/friends/invite/<token>`. The token is random
  with at least 128 bits, and its format is enforced by the database. The link does not expire and can be
  used by any number of people to send friendship requests. There is no search by name or email: nobody
  can find a stranger. A user can regenerate their link, which immediately invalidates the old token.
- **AC-3**: Opening an invite link signed out sends the visitor through sign-in and back to the link; the
  page before sign-in reveals neither the owner nor whether the link is valid. Signed in, the page shows the
  inviter's display name and a "Send request" button. After a request is sent the Friends page says so
  ("Request sent", AC-18), since the requester has nothing else to see until the inviter approves. Opening an unknown
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
  stage-by-stage progress. It shows no stamp dates, no notes and no extra stamps. The places a friend was not missing because
  they walked past before a new stamp was required (spec 0001 AC-17) count as done for their stage and make their stretches
  walked, as on their own dashboard, but they are no stamp (AC-25).
- **AC-8**: A friend's numbers are computed by the same functions as the owner's dashboard
  (`src/lib/progress.ts`), from the friend's stamped place ids, so the two never disagree.
- **AC-9**: Each user controls their side: per friend, a switch "show my progress to this friend". When it
  is off, that friend sees "not sharing" and no numbers, the name is no longer a link, and the friend's own page
  answers 404. The switch is independent in each direction.

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
  that check the friendship and the friend's sharing switch, and return nothing else than each friend's id and their stamped place ids
  (`get_friend_stamps`) or the keys of their waived places (`get_friend_waived_places`, AC-25).
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

### The Friends page responds

Every button on `/friends` (save name, regenerate link, approve, ignore, start and stop sharing, remove) and the invite
page's "Send request" is a plain form that posts to a server action ending in a redirect. The rules of the actions
(AC-12 to AC-14) are unchanged: only how the page reacts differs.

- **AC-17**: Pressing one of these buttons changes it at once, before the server answers: it is disabled and busy
  (`aria-busy`), a spinner replaces its label, and the label stays in the layout and for screen readers (transparent), so the button keeps its size and its name.
  A second press sends nothing more. The buttons of one row (approve and ignore of one request, sharing and remove of one
  friend, regenerate) share one busy state: while one runs, the other buttons of the row are disabled too (opening a confirmation question, which runs nothing, stays possible), and the buttons of other
  rows are not.
- **AC-18**: When an action is done the page says what happened, at the top and in the page's language: a success
  ("Name saved", "Link regenerated", "Friend request approved" or "ignored", "Friend removed", "Sharing stopped" or "started",
  and the "Request sent" of AC-3) as a polite status (`role="status"`, `aria-live="polite"`), a failure as an alert
  (`role="alert"`) with the text of its reason. The answer is in the URL: `?ok=<code>` or `?error=<reason>`. Only a code on
  the page's own list (`FRIEND_NOTICES`, `REQUEST_REFUSALS`, `unauthorized`, `failed`) is shown, as its message and never
  as the value itself; anything else, and the former `?sent=1`, shows nothing. The next action replaces the message (every
  action ends on `/friends` with its own answer) and the message scrolls into view.
- **AC-19**: Removing a friend and regenerating the invite link ask first, in the page and not with `window.confirm`: a
  `<details>` whose body says what will happen (removing: the two of you stop seeing each other's progress and the other is
  not told; regenerating: the old link stops working at once) and holds the form with the confirming button. Nothing runs on
  the first press. Cancel closes the question, and Escape too.
- **AC-20**: Every button of the page is at least 44 x 44 px (also at 375 px and 320 px), wraps onto a second line instead
  of overflowing, and, while enabled, looks different under the pointer (a darker shade) and while pressed (a darker still,
  nudged one pixel down), with a visible focus ring for the keyboard; a disabled button shows none of these. Approve and
  ignore differ by their words, not by colour alone.
- **AC-21**: The buttons stay plain forms: before hydration and with JavaScript off every action still works and ends on
  the page with its answer (AC-18), the confirmation of AC-19 still opens (the browser toggles a `<details>`), and Cancel,
  which needs JavaScript, is not drawn.

- **AC-25**: A friend's dates are not shared, so the places they were not missing (spec 0001 AC-17) are decided by the database from their own
  stamp dates and only their place keys leave it, never a date: `get_friend_waived_places()` returns `(friend_id, place_key)` for every accepted
  friend who shares with the caller, by the rule of `waivedPlaceKeys` in `src/lib/progress.ts` (the same answer for the same stamps). It is
  executable by signed-in users only. That set tells a friend that the other walked a place before its date; that is all of the dates that
  is shared. A friend's figures (AC-8), their stage completion (AC-7) and the comparison of AC-22 to AC-24 use it.

- **AC-26**: A friend's page lists no retired stamp (spec 0001 AC-22) and counts none of them: `get_friend_stamps` and `get_friend_waived_places` leave retired
  rows out, so a friend's figures stay equal to what their own dashboard counts (AC-8) and the retired stamps they collected are theirs alone.

### Comparing with a friend

- **AC-22**: A friend's page (only for an accepted friend who shares, AC-9: anyone else still ends on the 404, and nothing
  is computed) has a "Compare" section above the stage list, with the user's own progress next to the friend's: four cards
  (both, only me, only them, neither), each with the km and the number of places; a map of the two (spec 0003 AC-18 to AC-20);
  and a list of the stages with how each stands (AC-24), each linking to its section below. It shows nothing the friend did
  not already share: which places they stamped, never dates or extra stamps (AC-7). Besides the friend's shared stamps
  it reads only the user's own. At 375 px and 320 px the cards are two to a row and the map is full width, with no sideways scroll.
- **AC-23**: The places are counted as stamped by both, only me, only them or neither (a place with several variants once,
  spec 0001 AC-1). The walked stretches of each person follow spec 0001 AC-3, so the comparison never disagrees with either
  dashboard; the km walked by both is the intersection of the two sets of stretches, only me or only them what is left of one set, and
  neither the rest of the trail. The four figures add up to the trail's total km exactly: three are rounded to 0.1 (spec 0001 AC-4)
  and the fourth is the total minus them (never negative).
- **AC-24**: A stage stands as "both complete" (both have all its places, a place they were not missing counting as had, AC-25), "only me" (I have all, they do not), "only
  them", "neither started" (neither has any) or "partly", in this order, so a stage with one place that only I stamped is
  "only me". The page shows each person's count of the stage's places.

### Feature flag and texts

- **AC-15**: While the flag `friends` is off, `/friends`, `/friends/<id>` and `/friends/invite/*` answer 404,
  the actions return `disabled` without touching the database and no link to them is shown (the dashboard
  link, the About page paragraph). The flag is `friends` (spec 0035): off, on for the users on its
  allowlist, or on for everybody, read on every request, so a change shows on the next one with no deploy and no
  restart. It is on in production.
- **AC-16**: Every user-visible string exists in every language of the site. The About page (spec 0015) tells
  what friends can see and how to stop it (only while the flag is on: with it off the page must not mention
  a page that answers 404), and the changelog describes the friends page and each visible change to it like any
  other (spec 0018 AC-7): the flag exempts nothing while it is on in production.

## Out of scope

Public profile pages or links viewable without an account; groups, leaderboards and rankings; chat,
comments and reactions; notifications by email or push; a feed of friends' latest stamps; finding
people by name or email; importing contacts; showing a friend's dates or extra stamps, or comparing with several friends at once; sharing a
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
| AC-26 | `tests/retired-stamps-database.test.ts` (a friend who collected the retired stamp: neither function returns it) |
| AC-25 | `tests/stamp-dates-database.test.ts` (the database function answers exactly what `waivedPlaceKeys` does, in five spreads of dates over the whole trail; nothing for a pending or not sharing friend; not callable by `anon`), `src/lib/friends.test.ts` (only place keys per friend; the figures and stage completion with a waived place), `src/lib/compare.test.ts` (the comparison with one) |
| AC-9, AC-10 | `tests/friends-migration.test.ts`, `e2e/friends.spec.ts` |
| AC-11 | `e2e/friends.spec.ts` (delete the account, the friend's list is empty) |
| AC-12 | `tests/friends-migration.test.ts` (forged friendship, direct writes, token column, anon, the trigger function); Supabase advisors after applying |
| AC-13, AC-14 | `src/app/[locale]/(pages)/friends/actions.test.ts` (an action that fails is shown on the page: `e2e/friends.spec.ts`) |
| AC-15 | `actions.test.ts` (`disabled`); the pages, the dashboard link and the About paragraph in each state of the flag: `e2e/feature-flags.spec.ts` (spec 0035); the flag mechanism itself: spec 0035 |
| AC-16 | `tests/messages.test.ts`, `e2e/friends.spec.ts` (About paragraph); `src/content/changelog.ts` (the friends entries; the rule: spec 0018 AC-7) |
| AC-17 | `src/components/FriendActionButton.test.tsx` (pending, no second press, the row), `e2e/friends.spec.ts` (a slow server) |
| AC-18 | `src/lib/friends.test.ts` (the path, a message per notice in every language), `src/components/FriendActionButton.test.tsx` (status and alert), `e2e/friends.spec.ts` (each action, the default language and Russian, unknown values) |
| AC-19 | `src/components/FriendActionButton.test.tsx` (closed first, Cancel, Escape), `e2e/friends.spec.ts` (remove and regenerate ask first) |
| AC-20 | `src/components/FriendActionButton.test.tsx` (the classes), `e2e/friends.spec.ts` (target size and no sideways scroll at 375 and 320 px in the default language and Russian; the colour under the pointer and while pressed) |
| AC-21 | `e2e/friends.spec.ts` (JavaScript off) |
| AC-22 | `src/lib/friends-compare.test.ts` (what is read), `e2e/friends-compare.spec.ts` (figures, stage list, 404s, 375 and 320 px in the default language and German) |
| AC-23, AC-24 | `src/lib/compare.test.ts` |
