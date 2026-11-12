# Changelog

All notable changes to Chat Canvas are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-11-12

### Added

- Local Markdown downloads for ChatGPT and Gemini with message roles, source URL, rich text, nested lists, code fences, tables, and TeX math.
- Export controls independent of the outline, including collapsed messages and reporting skipped unloaded shells.
- Browser regression tests for Markdown downloads, Gemini response alignment, and minimal outlines.

### Changed

- Minimized outlines now display only a small `+` button and retain their minimized state when the host remounts the panel.
- Gemini's internal response wrappers fill the widened conversation column rather than remaining centered at the native width.

### Removed

- Claude site access, adapter, and popup setting. Existing ChatGPT/Gemini preferences are retained.

## [1.1.1] - 2026-10-05

### Fixed

- ChatGPT turn detection now handles semantic turn roles, rollout search-unit attributes, and mixed old/new message markup in document order.
- Nested ChatGPT message and composer constraints expand together, including the newer thread body width variable.
- Streaming text and late message attributes update controls and labels without continuous observer rebuilds.
- Outline labels and collapse state survive virtualized message remounts within a conversation; cached text clears on conversation navigation.
- Collapsed virtualized turns release their fixed height, and mobile fallback turns use the available column width.

### Added

- Local browser regression tests for ChatGPT layouts, width alignment, message controls, streaming, virtualization, navigation, settings, and Claude/Gemini detection.
- Instructions for updating an existing unpacked extension and refreshing its content scripts.

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

[1.2.0]: https://github.com/cs-giung/chat-canvas/releases/tag/v1.2.0
[1.1.1]: https://github.com/cs-giung/chat-canvas/releases/tag/v1.1.1
[1.1.0]: https://github.com/cs-giung/chat-canvas/releases/tag/v1.1.0
[1.0.0]: https://github.com/cs-giung/chat-canvas/releases/tag/v1.0.0
