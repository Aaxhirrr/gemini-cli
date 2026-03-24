# Curator Notes

Repository: `superset`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, superset/app.py, superset/config.py, superset-frontend/src/views/App.tsx.
- The required cross-file invariant is: "Superset app bootstrap should connect backend app creation, config loading, and frontend app mounting."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
