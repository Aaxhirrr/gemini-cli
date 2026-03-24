You are working in the real `airflow` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `airflow-core/src/airflow/cli/cli_config.py`
- `airflow-core/src/airflow/config_templates/config.yml`
- `airflow-core/src/airflow/jobs/scheduler_job_runner.py`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "Scheduler behavior should be explained by one path from CLI config through the config template into the scheduler job runner."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
