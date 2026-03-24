# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Align scheduler semantics with web UI and configuration defaults

- Why this is long-context: strong candidates will cross scheduler internals, DAG or dataset models, REST or web surfaces, config defaults, and operator documentation.
- Likely components: `airflow/jobs/`, `airflow/models/`, `airflow/config_templates/`, `airflow/api_fastapi/` or webserver code, and docs in `docs/`.
- Validation direction: scheduler-focused tests, API or UI assertions, and a docs update describing the corrected scheduling invariant.

