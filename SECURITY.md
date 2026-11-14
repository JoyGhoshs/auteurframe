# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability reporting on
https://github.com/joyghoshs/auteurframe/security/advisories/new and include:

- the AuteurFrame version (Settings shows it, or `release.json`) and whether you use the Windows app, Linux, WSL or Docker,
- what an attacker can do and the steps to reproduce it,
- any proof-of-concept code or requests.

You will get a reply within 7 days. Fixes are released as soon as they are ready and credited to the reporter unless
you prefer otherwise.

## Supported versions

Only the latest release receives security fixes. The Windows app and the studio check for new releases automatically.

## Scope

In scope: the AuteurFrame server and studio, the render service, the release and template feed, the Windows desktop
launcher and installer, and the Docker image.

Out of scope: vulnerabilities in third-party AI providers or in the open media libraries AuteurFrame searches, and
attacks that require an attacker who can already run programs as your user on your computer.
