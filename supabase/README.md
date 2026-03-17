## Supabase schema setup

This project stores each Excel upload as a versioned `upload`, and each row as a `report_node`.

### Apply migration

- **Supabase SQL editor**: open the file `supabase/migrations/20260216_init.sql`, paste into the SQL editor, and run.
- **Supabase CLI** (optional): if you’re using the CLI, place this repo under a Supabase project and run migrations normally.

