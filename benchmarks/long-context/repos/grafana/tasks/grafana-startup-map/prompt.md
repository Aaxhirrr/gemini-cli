You are working in the real `grafana` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `pkg/cmd/grafana/main.go`
- `pkg/setting/setting.go`
- `pkg/server/server.go`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "Grafana startup should flow from the CLI entrypoint through settings loading into server bootstrap."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
