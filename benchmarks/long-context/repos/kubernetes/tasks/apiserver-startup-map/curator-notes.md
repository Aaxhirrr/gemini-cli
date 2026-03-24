# Curator Notes

Repository: `kubernetes`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, cmd/kube-apiserver/apiserver.go, cmd/kube-apiserver/app/options/options.go, cmd/kube-apiserver/app/server.go.
- The required cross-file invariant is: "CLI startup flags, completed options, and server construction must describe one kube-apiserver startup path."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
