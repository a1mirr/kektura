# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting instead: on the
repository page choose **Security**, then **Report a vulnerability**. I read every report and answer as soon as I can.

Useful in a report: what you found, the steps or request that show it, and what an attacker could do with it.

The live site is <https://kektura-tracker.com>. Testing it is fine as long as you only use your own account and data,
do not disturb other users (no load testing, no spam through the feedback form) and stop at proof that a problem
exists.

## What matters most

The app holds users' Google sign-in profile (name, email) and the stamps they marked. Problems that would expose
another user's data, bypass row level security, or reach the server-only secrets (the Supabase service role key, the
Telegram bot token) are the ones to report first.
