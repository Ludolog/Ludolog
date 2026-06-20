# Ownership Transfer Checklist

This is a technical checklist for the Ludolog handoff. It is not a legal transfer document.

## Current Technical Ownership

- Repository: `https://github.com/Ludolog/Ludolog`
- Production: `https://ludolog.vercel.app`
- Database: Neon Ludolog project
- Product/app name: GameValue Radar

## Completed In Code

- Production URLs in docs, mobile defaults, middleware and tests point to Ludolog.
- Local-only secrets and dump files are ignored by Git.
- Handoff, onboarding, environment variable and production-state docs exist.
- Package metadata points to the Ludolog repo and production URL.

## Manual Steps Outside Code

1. Remove the old personal account from GitHub collaborators if it is no longer needed.
2. Confirm Vercel is owned by the Ludolog account/team.
3. Confirm Neon is owned by the Ludolog account/organization.
4. Rotate Neon passwords/connection strings, `ADMIN_API_SECRET`, `CRON_SECRET` and `STEAM_WEB_API_KEY`.
5. Delete local database dumps after the Ludolog production smoke tests are confirmed.
6. Delete old Vercel and Neon projects only after several days of stable Ludolog production.
7. Confirm the Ludolog owner can deploy, inspect logs, rotate env vars and restore the database.

## Notes

- Existing Git history may retain original commit authors. That is normal and separate from current repository ownership.
- If formal copyright or IP transfer is required, confirm it in a separate agreement outside this repository.
- Do not rewrite Git history with `filter-repo` or `filter-branch` without a separate explicit decision.
