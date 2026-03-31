# GSoC PoC: Test Output Logging for `gemini-cli`

Branch:

- `gsoc/poc-test-output-hygiene`

## What this is

This is a PoC for the `gemini-cli` issue about cleaning up test suite output.

The problem is simple:

- passing tests were printing too much extra stuff
- real failures were harder to notice
- green runs were harder to scan than they should be

The goal of this work is:

- make passing output short and predictable
- get close to one useful line per test file
- keep real failures visible
- add a check so the output does not get noisy again later

## What I changed

I changed four main parts of the repo:

1. Reporter layer

- added a custom Vitest reporter that keeps per-file results but removes extra
  success summary noise
- added a quiet JUnit reporter wrapper so the XML artifact is still written
  without printing another terminal line

Main file:

- `scripts/test-output/oneLineVitestReporter.js`

2. CLI test harness

- buffered `stdout` and `stderr` during tests
- only replayed captured terminal output when a test fails
- kept `act(...)` warnings as real failures instead of hiding them

Main file:

- `packages/cli/test-setup.ts`

3. Source-level cleanup

- redirected or reduced noisy writes that should not pollute passing Vitest runs
- fixed some direct terminal writes and warning paths

Example file:

- `packages/cli/src/config/policy.ts`

4. Measurement and enforcement

- added a script that can analyze test output
- counts bytes, raw lines, counted lines, and known noisy patterns
- fails if the output goes over the chosen threshold

Main file:

- `scripts/check-test-output.js`

## Main idea in plain English

The solution is not just `silent: true`.

It works like this:

1. Use a cleaner reporter so passing runs do not print extra summary noise.
2. Capture terminal writes during tests so passing tests stay quiet.
3. Only show captured terminal output if a test fails.
4. Fix noisy writes at the source where possible.
5. Run a script that checks whether output still matches the expected shape.

## What this PoC proves

On the CLI suite path, the PoC shows:

- older noisy CLI output: `444` counted lines for `405` CLI test files
- cleaned CLI output: `405` counted lines for `405` CLI test files
- tracked noisy patterns on the cleaned path: `0`

So the strongest claim here is:

- on the `gemini-cli` CLI test suite, passing output now reaches one counted
  result line per test file

## Important scope note

This PoC is strongest on the CLI suite.

I am **not** claiming that the full repo-wide `preflight` path is already
completely solved end-to-end. The repo still has unrelated flaky/failing tests
that can change output shape during live runs.

That is why this branch includes:

- live check commands
- saved stable logs for repeatable demos

## Demo

Run these from the repo root:

- `A:\Desktop\Google_Summer_of_Code2\Evals_Quality\gemini-cli`

### 1. Show the older noisy output

```powershell
Get-Content .test-output\cli-basic-reporter.log | Select-Object -First 32
```

What this shows:

- passing output used to include banners, warnings, and other junk mixed into
  the results

### 2. Show the cleaned output shape

```powershell
Get-Content .test-output\cli-direct-2threads.log | Select-Object -First 12
```

What this shows:

- the cleaned output is basically one result line per test file

### 3. Show how many CLI test files there are

```powershell
(Get-ChildItem packages/cli/src -Recurse -File -Include *.test.ts,*.test.tsx,*.spec.ts,*.spec.tsx).Count
```

Expected:

```text
405
```

### 4. Show the measured passing result on a stable saved log

```powershell
node scripts/check-test-output.js --input .test-output/cli-direct-2threads.log
```

Expected:

- `Counted lines: 405`
- noisy pattern counts should all be `0`

### 5. Show the guardrail failing on purpose

```powershell
node scripts/check-test-output.js --input .test-output/cli-direct-2threads.log --max-lines 404
```

Expected:

- fail with `counted line count 405 exceeds max-lines 404`

## If you want to run the real live CLI check

There is also a real command that reruns the CLI suite:

```powershell
npm run check:test-output:cli
```

This is stronger, but slower and less stable for demos because unrelated CLI
test flakes can make the run fail and print real diagnostics.

## Files to look at

If you want to understand the core logic quickly, start here:

- `packages/cli/vitest.config.ts`
- `scripts/test-output/oneLineVitestReporter.js`
- `packages/cli/test-setup.ts`
- `packages/cli/src/config/policy.ts`
- `scripts/check-test-output.js`
- `package.json`

## Related notes outside the repo

These extra notes live one level above the repo:

- `..\TEST_OUTPUT_LOGGING_POC_PLAN.md`
- `..\TEST_OUTPUT_LOGGING_DEMO.md`
- `..\TEST_OUTPUT_LOGGING_IMPLEMENTATION_FLOW.md`
- `..\TEST_OUTPUT_LOGGING_CODE_LOGIC.md`

They are supporting material for the proposal and demo. This README is the short
branch-level version.
