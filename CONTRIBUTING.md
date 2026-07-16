# Contributing

## Local setup

```bash
bun install
bun dev
```

## Quality gates (must pass before merging)

```bash
bun test           # Vitest — unit + governance tests
bunx tsgo          # typecheck (strict)
```

## Branch & commit

- Branch off `main`. Short kebab-case names: `feat/lead-tags`, `fix/pitch-cap`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- One logical change per PR.

## Where things live

| Concern                     | Path                                        |
|-----------------------------|---------------------------------------------|
| Routes / pages              | `src/routes/`                               |
| Server functions (RPC)      | `src/lib/*.functions.ts`                    |
| Public HTTP endpoints       | `src/routes/api/public/*`                   |
| Server-only helpers         | `src/lib/*.server.ts`                       |
| Zod schemas                 | `src/lib/schemas.ts`                        |
| UI primitives (shadcn)      | `src/components/ui/`                        |
| Domain components           | `src/components/`                           |
| Migrations                  | `supabase/migrations/`                      |

## Rules

- Never edit `src/routeTree.gen.ts` or files under `src/integrations/supabase/`.
- Never hardcode colors — use tokens defined in `src/styles.css`.
- Server secrets are read only inside `createServerFn` handlers via `process.env`.
- Every new `public.*` table needs `GRANT` statements + RLS policies in the same migration.
