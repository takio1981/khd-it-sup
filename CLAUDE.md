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

## Database schema changes

Do **not** run `prisma migrate dev` or `prisma db push` against this project's
schema. Change `database/schema.sql` (canonical DDL) + apply the matching
`ALTER TABLE`/`CREATE TABLE` directly to the live MariaDB container, then update
`backend/prisma/schema.prisma` and run `npx prisma generate` only.
