<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Database migrations

`.env.local` contains `DATABASE_URL` — a direct Postgres connection string to
the Supabase project. Apply every new migration automatically after writing it:

```bash
set -a && source .env.local && set +a
psql "$DATABASE_URL" -f supabase/migrations/NNN_name.sql
```

Never ask the user to run SQL by hand — apply it yourself, then verify with a
follow-up `psql -c` query before reporting done.
