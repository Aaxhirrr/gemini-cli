# Curator Notes

Repository: `grafana`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, pkg/cmd/grafana/main.go, pkg/setting/setting.go, pkg/server/server.go.
- The required cross-file invariant is: "Grafana startup should flow from the CLI entrypoint through settings loading into server bootstrap."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
