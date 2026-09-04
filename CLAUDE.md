# Project instructions for Claude

## Git workflow (standing instruction)

Every time a code change is made in this repo (any edit, feature, or fix), after
verifying it (typecheck/build/test as applicable), run in order:

```
git add <changed files>
git commit -m "<descriptive message>"
git push
```

This applies automatically going forward — the user does not need to ask again
each time. Remote: `https://github.com/takio1981/khd-it-sup.git`, branch `main`.

Never force-push. Never commit `.env` or any file containing real secrets
(SMTP password, JWT secrets, Telegram/LINE tokens, DB password) — these must
stay only in `.env`, which is gitignored.

## Changelog + SOP workflow diagrams (standing instruction)

Every time a code change is made in this repo (same trigger as the git workflow
rule above), as part of the same commit:

1. Add a dated entry to `CHANGELOG.md` (newest date at the top, new date section
   if today doesn't have one yet) — one or two short Thai bullet points
   describing what changed and why, not a copy of the commit message.
2. If the change alters a business process, workflow step, or data flow that is
   already depicted in
   `frontend/src/app/features/workflows/workflow-diagrams.component.ts` (the
   "ผังการทำงานระบบ (SOP)" page), update the affected Mermaid diagram(s) in
   that file so the SOP page stays accurate. Rebuild the frontend and check the
   diagram still renders correctly before committing.

Not every change touches the SOP diagrams (e.g. a pure UI styling tweak) — only
update them when the underlying process/workflow they depict actually changed.
The changelog entry, however, applies to every change, no exceptions.

## Database schema changes

Do **not** run `prisma migrate dev` or `prisma db push` against this project's
schema. Change `database/schema.sql` (canonical DDL) + apply the matching
`ALTER TABLE`/`CREATE TABLE` directly to the live MariaDB container, then update
`backend/prisma/schema.prisma` and run `npx prisma generate` only.
