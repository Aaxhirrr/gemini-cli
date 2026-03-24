# Candidate Tasks

Task status: intake candidate only. No runnable benchmark task has been extracted yet.

## Candidate 1: Preserve a cluster-setting invariant from REST layer through transport actions

- Why this is long-context: Elasticsearch candidates should force the agent to reason across REST parsing, transport execution, cluster-state metadata, serialization, and reference docs.
- Likely components: `server/src/main/java/org/elasticsearch/rest/`, `server/src/main/java/org/elasticsearch/action/`, cluster metadata packages, REST YAML tests, and docs.
- Validation direction: Java unit or REST tests plus documentation that codifies the corrected cluster behavior.

