# Curator Notes

Repository: `aspnetcore`
Task family: `real-repo-architecture-map`

Why this requires long-context reasoning:

- The model must reconcile the CLI or framework entrypoint with separate config ownership and runtime assembly files.
- The answer is only correct if it connects these files into one architectural flow: README.md, src/Hosting/Hosting/src/WebHostBuilder.cs, src/Hosting/Hosting/src/Internal/WebHost.cs, src/Http/Authentication.Core/src/AuthenticationService.cs.
- The required cross-file invariant is: "ASP.NET Core hosting and authentication should be traced from WebHostBuilder into the internal host and authentication service."

Validation strategy:

- Require the final answer to cite the key file paths.
- Require the final answer to use the benchmark headings.
- Do not require code changes; this is a runnable real-repo analysis task.
