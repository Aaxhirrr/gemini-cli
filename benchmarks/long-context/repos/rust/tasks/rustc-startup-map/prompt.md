You are working in the real `rust` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `compiler/rustc_driver/src/lib.rs`
- `compiler/rustc_interface/src/interface.rs`
- `compiler/rustc_session/src/config.rs`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "rustc startup should connect the driver entrypoint, compiler interface, and session configuration."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
