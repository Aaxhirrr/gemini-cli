# Curator Notes

Repository: `rails`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, railties/lib/rails.rb, railties/lib/rails/engine.rb, railties/lib/rails/application.rb.
- The required cross-file invariant is: "Rails application boot should connect the top-level rails entrypoint, engine mechanics, and application initialization."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
