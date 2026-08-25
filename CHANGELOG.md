# Changelog

All notable changes to Chat Canvas are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-08-25

### Added

- Claude support for conversation width, composer width, message collapsing, and the conversation outline.
- Claude selector fallbacks for streaming responses, completed responses, and attachment-only prompts.

### Changed

- Width discovery now expands nested centered constraints while applying the selected percentage only once.
- The conversation outline no longer appears on supported-site login, verification, or empty-chat pages.
- Documentation, privacy disclosures, validation, and issue templates now cover all three supported sites.

## [1.0.0] - 2026-08-25

### Added

- Adjustable conversation and composer width for ChatGPT and Gemini.
- Manual collapsing for both user messages and AI replies.
- Conversation outline with prompt navigation and active-item highlighting.
- Collapse-all and expand-all controls.
- Compact outline mode retaining the title, prompt count, and expand control.
- Per-site and per-feature preferences synchronized through browser storage.
- Light, dark, mobile, and reduced-motion styles.
- Manifest V3 packaging with minimal permissions and no remote code.

[1.1.0]: https://github.com/cs-giung/chat-canvas/releases/tag/v1.1.0
[1.0.0]: https://github.com/cs-giung/chat-canvas/releases/tag/v1.0.0
