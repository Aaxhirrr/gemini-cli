/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  ensureDir,
  readJsonFile,
  resolveBenchmarkRoot,
  writeJsonFile,
} from './shared.js';

type TaskSeed = {
  repositoryId: string;
  taskId: string;
  title: string;
  summary: string;
  taskFamily: string;
  targetComponents: string[];
  files: string[];
  invariant: string;
  tags: string[];
};

const TASK_SEEDS: TaskSeed[] = [
  {
    repositoryId: 'kubernetes',
    taskId: 'apiserver-startup-map',
    title: 'Map kube-apiserver startup assembly',
    summary:
      'Trace how kube-apiserver startup flows from the CLI entrypoint into option assembly and server construction.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['cli', 'options', 'server'],
    files: [
      'README.md',
      'cmd/kube-apiserver/apiserver.go',
      'cmd/kube-apiserver/app/options/options.go',
      'cmd/kube-apiserver/app/server.go',
    ],
    invariant:
      'CLI startup flags, completed options, and server construction must describe one kube-apiserver startup path.',
    tags: ['long-context', 'real-repo', 'go', 'kubernetes', 'analysis'],
  },
  {
    repositoryId: 'grafana',
    taskId: 'grafana-startup-map',
    title: 'Map Grafana server startup',
    summary:
      'Trace how the Grafana server starts from the CLI entrypoint through settings loading into runtime bootstrap.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['cli', 'settings', 'server'],
    files: [
      'README.md',
      'pkg/cmd/grafana/main.go',
      'pkg/setting/setting.go',
      'pkg/server/server.go',
    ],
    invariant:
      'Grafana startup should flow from the CLI entrypoint through settings loading into server bootstrap.',
    tags: ['long-context', 'real-repo', 'go', 'typescript', 'grafana', 'analysis'],
  },
  {
    repositoryId: 'nextjs',
    taskId: 'next-dev-config-map',
    title: 'Map next dev config flow',
    summary:
      'Trace how the Next.js dev command flows from CLI parsing into dev handling and shared server config loading.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['cli', 'dev-server', 'config'],
    files: [
      'README.md',
      'packages/next/src/bin/next.ts',
      'packages/next/src/cli/next-dev.ts',
      'packages/next/src/server/config.ts',
    ],
    invariant:
      'The next dev command should flow from CLI parsing into dev command handling and then shared server config loading.',
    tags: ['long-context', 'real-repo', 'typescript', 'nextjs', 'analysis'],
  },
  {
    repositoryId: 'airflow',
    taskId: 'scheduler-config-map',
    title: 'Map Airflow scheduler config flow',
    summary:
      'Trace how Airflow scheduler behavior is configured from CLI configuration into config templates and the scheduler job runner.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['cli', 'configuration', 'scheduler'],
    files: [
      'README.md',
      'airflow-core/src/airflow/cli/cli_config.py',
      'airflow-core/src/airflow/config_templates/config.yml',
      'airflow-core/src/airflow/jobs/scheduler_job_runner.py',
    ],
    invariant:
      'Scheduler behavior should be explained by one path from CLI config through the config template into the scheduler job runner.',
    tags: ['long-context', 'real-repo', 'python', 'airflow', 'analysis'],
  },
  {
    repositoryId: 'superset',
    taskId: 'bootstrap-config-map',
    title: 'Map Superset bootstrap and config flow',
    summary:
      'Trace how Superset bootstraps backend app creation, configuration, and frontend app mounting.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['backend', 'config', 'frontend'],
    files: [
      'README.md',
      'superset/app.py',
      'superset/config.py',
      'superset-frontend/src/views/App.tsx',
    ],
    invariant:
      'Superset app bootstrap should connect backend app creation, config loading, and frontend app mounting.',
    tags: ['long-context', 'real-repo', 'python', 'typescript', 'superset', 'analysis'],
  },
  {
    repositoryId: 'elasticsearch',
    taskId: 'node-bootstrap-map',
    title: 'Map Elasticsearch node bootstrap',
    summary:
      'Trace how Elasticsearch server startup flows from the CLI into bootstrap and then Node initialization.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['cli', 'bootstrap', 'node'],
    files: [
      'README.asciidoc',
      'distribution/tools/server-cli/src/main/java/org/elasticsearch/server/cli/ServerCli.java',
      'server/src/main/java/org/elasticsearch/bootstrap/Elasticsearch.java',
      'server/src/main/java/org/elasticsearch/node/Node.java',
    ],
    invariant:
      'Elasticsearch server startup should flow from the CLI into bootstrap and then Node initialization.',
    tags: ['long-context', 'real-repo', 'java', 'elasticsearch', 'analysis'],
  },
  {
    repositoryId: 'kafka',
    taskId: 'broker-startup-map',
    title: 'Map Kafka broker startup',
    summary:
      'Trace how Kafka broker startup connects the main entrypoint, broker configuration, and broker server runtime.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['cli', 'config', 'broker'],
    files: [
      'README.md',
      'core/src/main/scala/kafka/Kafka.scala',
      'core/src/main/scala/kafka/server/KafkaConfig.scala',
      'core/src/main/scala/kafka/server/BrokerServer.scala',
    ],
    invariant:
      'Kafka broker startup should connect the main entrypoint, broker config, and broker server runtime.',
    tags: ['long-context', 'real-repo', 'java', 'scala', 'kafka', 'analysis'],
  },
  {
    repositoryId: 'rails',
    taskId: 'rails-boot-map',
    title: 'Map Rails application boot',
    summary:
      'Trace how Rails application boot flows from the top-level framework entrypoint into engine and application initialization.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['framework-entrypoint', 'engine', 'application'],
    files: [
      'README.md',
      'railties/lib/rails.rb',
      'railties/lib/rails/engine.rb',
      'railties/lib/rails/application.rb',
    ],
    invariant:
      'Rails application boot should connect the top-level rails entrypoint, engine mechanics, and application initialization.',
    tags: ['long-context', 'real-repo', 'ruby', 'rails', 'analysis'],
  },
  {
    repositoryId: 'aspnetcore',
    taskId: 'hosting-auth-map',
    title: 'Map ASP.NET Core hosting and auth flow',
    summary:
      'Trace how ASP.NET Core hosting is assembled from WebHostBuilder into the internal host and authentication service.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['hosting', 'runtime', 'authentication'],
    files: [
      'README.md',
      'src/Hosting/Hosting/src/WebHostBuilder.cs',
      'src/Hosting/Hosting/src/Internal/WebHost.cs',
      'src/Http/Authentication.Core/src/AuthenticationService.cs',
    ],
    invariant:
      'ASP.NET Core hosting and authentication should be traced from WebHostBuilder into the internal host and authentication service.',
    tags: ['long-context', 'real-repo', 'csharp', 'aspnetcore', 'analysis'],
  },
  {
    repositoryId: 'rust',
    taskId: 'rustc-startup-map',
    title: 'Map rustc startup and session configuration',
    summary:
      'Trace how rustc startup connects the driver entrypoint, compiler interface, and session configuration.',
    taskFamily: 'real-repo-architecture-map',
    targetComponents: ['driver', 'interface', 'session-config'],
    files: [
      'README.md',
      'compiler/rustc_driver/src/lib.rs',
      'compiler/rustc_interface/src/interface.rs',
      'compiler/rustc_session/src/config.rs',
    ],
    invariant:
      'rustc startup should connect the driver entrypoint, compiler interface, and session configuration.',
    tags: ['long-context', 'real-repo', 'rust', 'compiler', 'analysis'],
  },
];

function toTaskRelativePath(repositoryId: string, filePath: string) {
  return `../../../../snapshots/${repositoryId}/${filePath}`.replace(
    /\\/g,
    '/',
  );
}

const TASK_SCHEMA_PATH = '../../../../schemas/task.schema.json';
const TASK_VALIDATOR_PATH = '../../../../task-validators/architecture-map.js';
const EXTRACTION_JUSTIFICATION =
  'PoC extraction limited to pinned startup and configuration anchor files so the benchmark remains runnable in-repo while full-repository task curation is still in progress.';

function buildPrompt(seed: TaskSeed) {
  const fileList = seed.files.map((filePath) => `- \`${filePath}\``).join('\n');
  return [
    `You are working in the real \`${seed.repositoryId}\` benchmark snapshot.`,
    '',
    `Trace the startup, configuration, and runtime assembly path across these files:`,
    '',
    fileList,
    '',
    'Write a concise architecture map with exactly these headings:',
    '',
    '- `Entrypoint:`',
    '- `Config surface:`',
    '- `Runtime assembly:`',
    '- `Cross-file invariant:`',
    '- `Files consulted:`',
    '',
    'Requirements:',
    '',
    '- Mention at least 3 exact repository-relative file paths.',
    `- Ground the invariant in the files above and conclude with: "${seed.invariant}"`,
    '- Do not propose edits or code changes.',
    '- Keep the answer under 220 words.',
    '',
  ].join('\n');
}

function buildCuratorNotes(seed: TaskSeed) {
  return [
    '# Curator Notes',
    '',
    `Repository: \`${seed.repositoryId}\``,
    `Task family: \`${seed.taskFamily}\``,
    '',
    'Why this requires long-context reasoning:',
    '',
    `- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.`,
    `- The answer is only correct if it connects these files into one architectural flow: ${seed.files.join(', ')}.`,
    `- The required cross-file invariant is: "${seed.invariant}"`,
    '',
    'Validation strategy:',
    '',
    '- Require the final answer to cite the key file paths.',
    '- Require the final answer to use the benchmark headings.',
    '- Do not require code changes; this is a runnable real-repo analysis task.',
    '',
  ].join('\n');
}

function buildFinalAnswer(seed: TaskSeed) {
  return [
    `Entrypoint: \`${seed.files[1]}\` is the main execution entrypoint, with \`${seed.files[0]}\` providing top-level repository context.`,
    `Config surface: \`${seed.files[2]}\` is the primary configuration or option-definition surface that shapes startup behavior.`,
    `Runtime assembly: \`${seed.files[3]}\` carries the runtime assembly path that turns configuration into the live server, framework, or compiler flow.`,
    `Cross-file invariant: ${seed.invariant}`,
    `Files consulted: \`${seed.files[0]}\`, \`${seed.files[1]}\`, \`${seed.files[2]}\`, \`${seed.files[3]}\`.`,
  ].join('\n');
}

function buildFakeResponses(seed: TaskSeed) {
  const classifier = {
    method: 'generateContent',
    response: {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: JSON.stringify({
                  reasoning:
                    'This request is a repository architecture map that requires cross-file reasoning and precise path grounding.',
                  model_choice: 'pro',
                }),
              },
            ],
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
    },
  };

  const finalResponse = {
    method: 'generateContentStream',
    response: [
      {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: buildFinalAnswer(seed),
                },
              ],
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      },
    ],
  };

  return `${JSON.stringify(classifier)}\n${JSON.stringify(finalResponse)}\n`;
}

async function updateRepositoryTask(seed: TaskSeed, benchmarkRoot: string) {
  const repositoryFile = path.join(
    benchmarkRoot,
    'repos',
    seed.repositoryId,
    'repository.json',
  );
  const repository = await readJsonFile<{
    fixtureRoot?: string;
    source?: {
      extractionJustification?: string;
    };
    tasks: Array<{ taskId: string; taskDirectory: string; tags?: string[] }>;
  }>(repositoryFile);

  repository.fixtureRoot = `../../snapshots/${seed.repositoryId}`;
  repository.source = {
    ...repository.source,
    extractionJustification: EXTRACTION_JUSTIFICATION,
  };
  repository.tasks = [
    {
      taskId: seed.taskId,
      taskDirectory: `./tasks/${seed.taskId}`,
      tags: ['real', 'runnable', 'analysis'],
    },
  ];

  await writeJsonFile(repositoryFile, repository);
}

async function writeTask(seed: TaskSeed, benchmarkRoot: string) {
  const taskDir = path.join(
    benchmarkRoot,
    'repos',
    seed.repositoryId,
    'tasks',
    seed.taskId,
  );
  await ensureDir(taskDir);

  const taskJson = {
    $schema: TASK_SCHEMA_PATH,
    schemaVersion: '1.0.0',
    taskId: seed.taskId,
    repositoryId: seed.repositoryId,
    title: seed.title,
    summary: seed.summary,
    category: 'analysis',
    difficulty: 'medium',
    taskFamily: seed.taskFamily,
    promptFile: './prompt.md',
    curatorNotesFile: './curator-notes.md',
    tags: seed.tags,
    targetComponents: seed.targetComponents,
    recommendedReadFiles: seed.files.map((filePath) =>
      toTaskRelativePath(seed.repositoryId, filePath),
    ),
    expectedTouchedFiles: seed.files
      .slice(1)
      .map((filePath) => toTaskRelativePath(seed.repositoryId, filePath)),
    protectedFiles: [],
    expectedLongContextReasoning:
      'The answer is only correct if the agent traces the architectural flow across the repo entrypoint, configuration surface, and runtime assembly paths instead of summarizing one file in isolation.',
    acceptanceCriteria: [
      'Names the repository entrypoint file and its role.',
      'Names the main configuration surface and its role.',
      'Names the runtime assembly file and its role.',
      `Ends with the benchmark invariant: "${seed.invariant}"`,
    ],
    execution: {
      timeoutMinutes: 5,
      fakeResponsesFile: './smoke.responses.jsonl',
    },
    validation: {
      resultMustContain: [seed.files[1], seed.files[2], seed.files[3], seed.invariant],
      validatorFile: TASK_VALIDATOR_PATH,
    },
  };

  await writeJsonFile(path.join(taskDir, 'task.json'), taskJson);
  await fs.writeFile(path.join(taskDir, 'prompt.md'), buildPrompt(seed), 'utf8');
  await fs.writeFile(
    path.join(taskDir, 'curator-notes.md'),
    buildCuratorNotes(seed),
    'utf8',
  );
  await fs.writeFile(
    path.join(taskDir, 'smoke.responses.jsonl'),
    buildFakeResponses(seed),
    'utf8',
  );
}

async function updateManifest(benchmarkRoot: string) {
  const manifestPath = path.join(benchmarkRoot, 'manifest.json');
  const manifest = await readJsonFile<{
    shards?: Array<{
      shardId: string;
      title: string;
      description: string;
      taskIds?: string[];
      modes?: string[];
    }>;
  }>(manifestPath);

  const shard = {
    shardId: 'real-repo-analysis',
    title: 'Real Repository Analysis',
    description:
      'Manual shard for real pinned repositories with runnable cross-file architecture map tasks.',
    taskIds: TASK_SEEDS.map(
      (seed) => `${seed.repositoryId}/${seed.taskId}`,
    ),
    modes: ['manual'],
  };

  const existing = manifest.shards || [];
  const withoutOld = existing.filter(
    (candidate) => candidate.shardId !== shard.shardId,
  );
  manifest.shards = [...withoutOld, shard];
  await writeJsonFile(manifestPath, manifest);
}

async function main() {
  const benchmarkRoot = resolveBenchmarkRoot();
  for (const seed of TASK_SEEDS) {
    await updateRepositoryTask(seed, benchmarkRoot);
    await writeTask(seed, benchmarkRoot);
  }
  await updateManifest(benchmarkRoot);
  process.stdout.write(
    `Generated ${TASK_SEEDS.length} real-repo runnable benchmark tasks.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
