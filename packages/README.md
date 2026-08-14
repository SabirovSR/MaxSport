# Deep modules

Each package under `packages/<name>/` is a **deep module**: behaviour lives behind a small public surface.

## Layout

```
packages/<name>/
  index.ts       ← entry point (public)
  client.ts      ← optional additional entry point
  lib/           ← implementation (private)
  tests/         ← tests (private fixtures OK inside tests/)
```

## Rules

1. **Entry-point boundary** — import packages only through their root files, never `lib/` or other subfolders.
2. **Intra-package freedom** — files inside a package may import each other freely.
3. **Tests through entry points** — tests exercise packages via entry points, not internals.
4. **No cycles** — no circular dependencies between packages.

Avoid barrel files that re-export entire subtrees. Prefer several small entry points.

## Check boundaries

```bash
npm run lint:boundaries
```

## Copy-me template

See `packages/example/` for a minimal deep module.
