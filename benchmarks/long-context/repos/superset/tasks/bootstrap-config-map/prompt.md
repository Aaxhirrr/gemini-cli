You are working in the real `superset` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `superset/app.py`
- `superset/config.py`
- `superset-frontend/src/views/App.tsx`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "Superset app bootstrap should connect backend app creation, config loading, and frontend app mounting."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
