# Security Policy

## Supported versions

Security fixes are applied to the latest released version.

## Reporting a vulnerability

Please do not include sensitive conversation content, authentication data, cookies, or tokens in a public issue.

Report a potential vulnerability through GitHub's private vulnerability reporting feature:

<https://github.com/cs-giung/chat-canvas/security/advisories/new>

Include a clear description, reproduction steps, affected version, and potential impact. You can expect an initial response within seven days.

## Security principles

Chat Canvas intentionally:

- requests only the `storage` permission;
- restricts content scripts to supported chat origins;
- includes no remote code, analytics, or network requests; and
- does not store or transmit conversation text.
