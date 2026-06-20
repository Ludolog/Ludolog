# Legacy Links Audit

Last updated: 2026-06-20

This audit tracks old technical ownership links found during the Ludolog handoff. It intentionally avoids storing secrets or filled connection strings.

| Area | Location | Finding | Decision |
| --- | --- | --- | --- |
| Git remote | Git config | `origin` points to `https://github.com/Ludolog/Ludolog.git` | kept-with-reason: correct current remote |
| Git identity | Local repo config | previous local author config used an old personal identity | replaced: local-only config set to neutral `Ludolog` identity; commit history not rewritten |
| GitHub legacy repo | tracked files | no active old GitHub repo URL found | removed/not-present |
| Vercel legacy domain | `AGENTS.md`, `HANDOFF.md` | old production URL was documented as legacy text | removed from normal docs |
| Vercel old account/scope | `HANDOFF.md`, `docs/current-production-state.md` | old Vercel account/scope was documented as a verification note | replaced with neutral wording |
| Neon legacy host | `docs/deployment.md`, `docs/repository-setup.md` | old concrete Neon host fragments appeared in examples | replaced with neutral Neon Ludolog placeholders |
| Local workstation path | user prompt only | local path is used for this development workstation | kept-with-reason: not present in tracked project docs |
| Product name | project docs and package metadata | `GameValue Radar` remains as the product/app name | kept-with-reason: Ludolog is the owner/repo/deployment, not a product rename decision |
| Production URL | docs, mobile config, middleware, tests | current URL is `https://ludolog.vercel.app` | kept-with-reason: correct current deployment |

## Manual Action

- Remove old Vercel and Neon projects only after several days of clean Ludolog production smoke tests.
- Remove old collaborators only after confirming the Ludolog owner can deploy, rotate secrets and recover the database.
- Rotate exposed or previously copied secrets outside the repo.
