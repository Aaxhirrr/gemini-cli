You are working in the real `kubernetes` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `cmd/kube-apiserver/apiserver.go`
- `cmd/kube-apiserver/app/options/options.go`
- `cmd/kube-apiserver/app/server.go`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "CLI startup flags, completed options, and server construction must describe one kube-apiserver startup path."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
