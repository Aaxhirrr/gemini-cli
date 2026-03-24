You are working in the real `kafka` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `core/src/main/scala/kafka/Kafka.scala`
- `core/src/main/scala/kafka/server/KafkaConfig.scala`
- `core/src/main/scala/kafka/server/BrokerServer.scala`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "Kafka broker startup should connect the main entrypoint, broker config, and broker server runtime."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
