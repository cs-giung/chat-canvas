# Contributing

Contributions and focused bug reports are welcome.

## Development setup

1. Fork and clone the repository.
2. Load the repository root through **Load unpacked** at `chrome://extensions`.
3. Make a focused change.
4. Run `./scripts/validate.sh`.
5. Reload the extension and test on every affected site.

No dependency installation or build step is required.

## Pull requests

- Keep changes narrowly scoped.
- Preserve the extension's local-only operation and minimal permissions.
- Do not add remote scripts, analytics, trackers, or network requests.
- Update documentation and `CHANGELOG.md` for user-visible changes.
- Explain which site, browser version, light/dark mode, and viewport sizes were tested.
- Avoid selectors based only on generated class names. Prefer semantic elements, roles, test IDs, and layout detection.

## Bug reports

AI chat interfaces change frequently. Helpful reports include:

- affected site and exact URL type;
- extension and browser versions;
- whether collapse bars and the outline are visible;
- expected and actual behavior;
- screenshots with private conversation content removed; and
- relevant DOM structure or selectors, when available.

By contributing, you agree that your contribution is licensed under the project's MIT License.
