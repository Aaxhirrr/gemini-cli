You are working in the real `elasticsearch` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.asciidoc`
- `distribution/tools/server-cli/src/main/java/org/elasticsearch/server/cli/ServerCli.java`
- `server/src/main/java/org/elasticsearch/bootstrap/Elasticsearch.java`
- `server/src/main/java/org/elasticsearch/node/Node.java`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "Elasticsearch server startup should flow from the CLI into bootstrap and then Node initialization."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
