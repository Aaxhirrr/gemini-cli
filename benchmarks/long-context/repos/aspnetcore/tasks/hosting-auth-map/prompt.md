You are working in the real `aspnetcore` benchmark snapshot.

Trace the startup, configuration, and runtime assembly path across these files:

- `README.md`
- `src/Hosting/Hosting/src/WebHostBuilder.cs`
- `src/Hosting/Hosting/src/Internal/WebHost.cs`
- `src/Http/Authentication.Core/src/AuthenticationService.cs`

Write a concise architecture map with exactly these headings:

- `Entrypoint:`
- `Config surface:`
- `Runtime assembly:`
- `Cross-file invariant:`
- `Files consulted:`

Requirements:

- Mention at least 3 exact repository-relative file paths.
- Ground the invariant in the files above and conclude with: "ASP.NET Core hosting and authentication should be traced from WebHostBuilder into the internal host and authentication service."
- Do not propose edits or code changes.
- Keep the answer under 220 words.
