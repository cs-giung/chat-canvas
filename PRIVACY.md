# Privacy Policy

**Effective date:** August 25, 2026

Chat Canvas is designed to operate entirely inside your browser.

## Data collection

Chat Canvas does not collect, transmit, sell, or share personal information, conversation content, browsing history, or usage analytics.

## Local processing

On supported AI chat pages, the extension temporarily reads rendered message text to create:

- conversation outline labels; and
- previews for collapsed messages.

This processing occurs in the current browser tab. Conversation text is not written to extension storage and is not sent to any server by Chat Canvas.

## Stored preferences

The extension uses Chrome's `storage.sync` API to save settings such as content width, enabled features, and enabled sites. Depending on your browser configuration, the browser vendor may sync these preferences through your signed-in browser account. These settings do not contain conversation text.

## Permissions and site access

Chat Canvas requests only the `storage` permission. Content scripts are restricted to:

- `https://chatgpt.com/*`
- `https://gemini.google.com/*`

The extension does not use remote code or make network requests.

## Changes

Material changes to this policy will be documented in the repository and accompanied by an updated effective date.

## Contact

For privacy questions, open an issue at <https://github.com/cs-giung/chat-canvas/issues>.
