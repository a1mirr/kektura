# 0014: Pages and Settings

Status: Accepted
Owner code: `src/app/[locale]/(pages)/*`, `src/app/[locale]/settings/*`

## Goal

Add informational pages (About, Changelog, Useful Links, Feedback) with footer navigation, and a Settings page for user account management (including account deletion and displaying statistics previously found on the dashboard).

## Behaviour

### Footer Navigation
- **AC-1**: All pages include a footer with links to About, Changelog, Useful Links, and Feedback form.

### Informational Pages
- **AC-2**: `/about` renders information about the Kéktúra tracker app.
- **AC-3**: `/changelog` renders recent updates.
- **AC-4**: `/links` renders useful links related to the trail.

### Feedback Form
- **AC-5**: `/feedback` renders a form for the user to submit feedback.
- **AC-6**: Submitting feedback inserts a row into a `user_feedback` Supabase table. 

### Settings Page
- **AC-7**: `/settings` provides an "Account Settings" view for authenticated users.
- **AC-8**: The "Stamps per month" chart (previously on `/dashboard`) is displayed on `/settings`.
- **AC-9**: A "Delete Account" button exists on `/settings` that permanently deletes the user's account and all associated data, then redirects to the sign-in page.

## Out of scope
- Setting up a Telegram bot explicitly if the Supabase DB insertion is sufficient for the first iteration. 

## Notes
- "Delete account" requires an RPC function in Supabase because the client cannot delete its own auth user without elevated privileges.
- Need to update `src/i18n/messages/en.json` and `hu.json`.

## Coverage
| AC | Test |
| --- | --- |
| AC-1 | manual: verify footer links |
| AC-5,6 | manual: submit feedback, check DB |
| AC-7,8 | manual: check `/settings` page and chart |
| AC-9 | manual: click delete, verify DB empty |
