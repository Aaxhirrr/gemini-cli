import fs from 'node:fs/promises';

const REQUIRED_HEADINGS = [
  'Entrypoint:',
  'Config surface:',
  'Runtime assembly:',
  'Cross-file invariant:',
  'Files consulted:',
];

export async function validate({ resultText, task }) {
  const missingHeadings = REQUIRED_HEADINGS.filter(
    (heading) => !resultText.includes(heading),
  );

  if (missingHeadings.length > 0) {
    return {
      status: 'failed',
      summary: `Missing required headings: ${missingHeadings.join(', ')}`,
    };
  }

  const codePathMatches = resultText.match(/`[^`]+`/g) || [];
  if (codePathMatches.length < 3) {
    return {
      status: 'failed',
      summary: 'Result must cite at least 3 repository-relative file paths.',
    };
  }

  if (task?.promptFile) {
    const prompt = await fs.readFile(task.promptFile, 'utf8');
    if (!prompt.includes('Cross-file invariant:')) {
      return {
        status: 'failed',
        summary: 'Prompt contract for architecture map headings is missing.',
      };
    }
  }

  return {
    status: 'passed',
    summary: 'Architecture map output included the required headings and file references.',
  };
}
