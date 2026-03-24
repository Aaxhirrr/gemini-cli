# Curator Notes

Repository: `airflow`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, airflow-core/src/airflow/cli/cli_config.py, airflow-core/src/airflow/config_templates/config.yml, airflow-core/src/airflow/jobs/scheduler_job_runner.py.
- The required cross-file invariant is: "Scheduler behavior should be explained by one path from CLI config through the config template into the scheduler job runner."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
