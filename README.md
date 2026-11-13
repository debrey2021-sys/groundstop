# Is the ground stop over?

A single-answer status page for the FAA nationwide ground stop of November 13, 2026.

- `index.html`, `style.css`, `app.js`: the static site.
- `data` branch: `national.json` (hand-confirmed nationwide status and timeline) and `airports.json` (written by the workflow from the FAA's public airport event feed). The page reads both from that branch, so status changes need no redeploy.
- `.github/workflows/faa.yml`: refreshes `airports.json` every few minutes.

## Updating the headline

Edit `national.json` on the `data` branch. Set `verifiedAt` each time you re-check. When the stop lifts, set `"state": "lifted"`, fill `liftedAt`, and rewrite `summary`. If `verifiedAt` is more than an hour old while the state is `active`, the page stops saying "NO" and says the status is unconfirmed.

Unofficial. Not affiliated with the FAA.
