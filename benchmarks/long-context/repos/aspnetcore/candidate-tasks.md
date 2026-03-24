# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Align authentication and endpoint metadata behavior across hosting models

- Why this is long-context: good ASP.NET Core tasks typically span middleware, endpoint metadata, minimal APIs or MVC/Blazor layers, analyzers or templates, and docs.
- Likely components: `src/Security/`, `src/Http/`, `src/Middleware/`, selected `src/Components/` or `src/Mvc/` paths, and docs under `src/ProjectTemplates/` or `docs/`.
- Validation direction: framework tests covering both hosting paths plus docs or template updates for the resulting auth contract.

