You are working in the real `rails` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `railties/lib/rails.rb`
- `railties/lib/rails/engine.rb`
- `railties/lib/rails/application.rb`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "Rails application boot should connect the top-level rails entrypoint, engine mechanics, and application initialization."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
