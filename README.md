# Chat Canvas

A private, lightweight browser extension for making long AI conversations wider, collapsible, and easier to navigate.

[![Validate](https://github.com/cs-giung/chat-canvas/actions/workflows/validate.yml/badge.svg)](https://github.com/cs-giung/chat-canvas/actions/workflows/validate.yml)
[![Release](https://img.shields.io/github/v/release/cs-giung/chat-canvas)](https://github.com/cs-giung/chat-canvas/releases/latest)
[![License](https://img.shields.io/github/license/cs-giung/chat-canvas)](LICENSE)

## Demo

[![Animated demonstration of Chat Canvas widening a conversation and using its outline controls](assets/chat-canvas-demo.gif)](assets/chat-canvas-demo.mp4)

_Click the preview to open the higher-quality MP4 recording._

## Features

- Adjustable message and composer width from 55% to 100%
- Manually collapsible user messages and AI replies
- Collapse-all and expand-all controls
- Live conversation outline generated from your prompts
- Compact outline mode that retains the prompt count and expand button
- Per-site controls for ChatGPT, Claude, and Gemini
- Light mode, dark mode, and reduced-motion support
- No analytics, accounts, remote code, or network requests

## Install

### From a GitHub release

1. Download `chat-canvas-v1.1.0.zip` from the [latest release](https://github.com/cs-giung/chat-canvas/releases/latest).
2. Unzip the archive.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the unzipped directory.
6. Pin **Chat Canvas**, then refresh any open ChatGPT or Gemini tabs.

### From source

```sh
git clone https://github.com/cs-giung/chat-canvas.git
```

Load the cloned `chat-canvas` directory as an unpacked extension using the steps above.

## Usage

- Adjust **Content width** from the extension popup.
- Click the subtle vertical bar beside a message to collapse it.
- Click a collapsed preview to expand it.
- Use the floating outline to jump to a prompt or collapse/expand all messages.
- Select `−` to compact the outline to its title, prompt count, and `+` button.
- Disable individual features or supported sites from the popup at any time.

## Privacy and permissions

Chat Canvas requests only Chrome's `storage` permission, which stores and optionally browser-syncs preferences. Its content scripts are restricted to:

- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`

Rendered message text is processed temporarily in the page to create outline labels and collapsed previews. Conversation text is never stored or transmitted by Chat Canvas. See [PRIVACY.md](PRIVACY.md) for the complete policy.

## Development

Chat Canvas uses plain JavaScript, CSS, and Manifest V3. There are no runtime dependencies and no build step.

```sh
./scripts/validate.sh       # Static validation
./scripts/package.sh        # Create dist/chat-canvas-v1.1.0.zip
```

After changing extension files, reload Chat Canvas from `chrome://extensions` and refresh the target page.

AI products change their markup frequently. Platform selectors are grouped near the top of [`content/content.js`](content/content.js). Please include the affected site and browser version in bug reports.

## Contributing and security

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.
- Report security concerns according to [SECURITY.md](SECURITY.md).
- Changes are documented in [CHANGELOG.md](CHANGELOG.md).

## Disclaimer

Chat Canvas is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or Google. Claude, ChatGPT, and Gemini are trademarks of their respective owners.

## License

[MIT](LICENSE)
