# Curator Notes

Repository: `nextjs`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, packages/next/src/bin/next.ts, packages/next/src/cli/next-dev.ts, packages/next/src/server/config.ts.
- The required cross-file invariant is: "The next dev command should flow from CLI parsing into dev command handling and then shared server config loading."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
