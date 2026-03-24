# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Reconcile consumer-group coordinator semantics with protocol and tooling

- Why this is long-context: promising Kafka tasks cut across protocol schemas, broker coordinator logic, admin tooling, tests, and configuration docs.
- Likely components: `core/`, `clients/`, `group-coordinator/`, protocol definitions, command-line tooling, and `docs/`.
- Validation direction: broker or protocol tests, tooling assertions, and documentation updates that reflect the final coordinator contract.

