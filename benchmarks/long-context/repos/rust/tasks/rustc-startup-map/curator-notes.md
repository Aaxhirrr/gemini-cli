# Curator Notes

Repository: `rust`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, compiler/rustc_driver/src/lib.rs, compiler/rustc_interface/src/interface.rs, compiler/rustc_session/src/config.rs.
- The required cross-file invariant is: "rustc startup should connect the driver entrypoint, compiler interface, and session configuration."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
