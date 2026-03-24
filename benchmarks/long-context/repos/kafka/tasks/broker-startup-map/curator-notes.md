# Curator Notes

Repository: `kafka`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, core/src/main/scala/kafka/Kafka.scala, core/src/main/scala/kafka/server/KafkaConfig.scala, core/src/main/scala/kafka/server/BrokerServer.scala.
- The required cross-file invariant is: "Kafka broker startup should connect the main entrypoint, broker config, and broker server runtime."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
