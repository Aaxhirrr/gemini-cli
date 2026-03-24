# Curator Notes

Repository: `elasticsearch`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.asciidoc, distribution/tools/server-cli/src/main/java/org/elasticsearch/server/cli/ServerCli.java, server/src/main/java/org/elasticsearch/bootstrap/Elasticsearch.java, server/src/main/java/org/elasticsearch/node/Node.java.
- The required cross-file invariant is: "Elasticsearch server startup should flow from the CLI into bootstrap and then Node initialization."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
