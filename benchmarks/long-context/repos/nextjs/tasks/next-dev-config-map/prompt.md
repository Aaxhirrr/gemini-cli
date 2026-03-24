You are working in the real `nextjs` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `packages/next/src/bin/next.ts`
- `packages/next/src/cli/next-dev.ts`
- `packages/next/src/server/config.ts`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "The next dev command should flow from CLI parsing into dev command handling and then shared server config loading."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
