import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../content/content.js", import.meta.url));
const stylesheet = fileURLToPath(new URL("../content/content.css", import.meta.url));
let browser;

before(async () => {
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); });

// Synthetic fixtures cover the semantic hooks reported in these adapters;
// they do not claim to be captures of an authenticated ChatGPT session.
// https://github.com/qayshp/chatgpt-playwright-backend/blob/main/src/dom-runtime.js
// https://github.com/boabab/conversation-overview
const message = (role, text, layout = "rollout", index = role === "user" ? 1 : 2) => {
  const attrs = layout === "legacy"
    ? `data-message-author-role="${role}" data-message-id="message-${index}"`
    : `data-chatgpt-search-unit-key="message-${index}:${role}" data-chatgpt-search-message-ids="message-${index}"`;
  const tag = layout === "legacy" ? "article" : "section";
  return `<${tag} data-testid="conversation-turn-${index}" data-turn="${role}" data-turn-id="turn-${index}">
    <h5 class="sr-only">${role === "user" ? "You" : "ChatGPT"} said:</h5>
    <div class="shell-child"><div class="inner-limit" id="body-${index}">
      <div ${attrs}><div class="message-text" ${role === "user" ? "data-user-message-bubble" : 'data-markdown-text-style="assistant-message"'}>${text}</div></div>
      <button>Copy</button><button>Edit</button>
    </div></div>
  </${tag}>`;
};

const fixture = (content, composer = '<form data-chatgpt-composer><div role="textbox" contenteditable="true" aria-label="Chat with ChatGPT"></div></form>') => `<!doctype html>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px sans-serif; }
    aside { position: fixed; width: 240px; height: 100vh; }
    main { margin-left: 240px; width: calc(100% - 240px); }
    .conversation { max-width: 768px; margin-inline: auto; }
    .inner-limit { max-width: 640px; margin-inline: auto; }
    .composer-column { max-width: 640px; margin-inline: auto; }
    .composer-inner { max-width: 560px; margin-inline: auto; }
    form { width: 100%; }
    [contenteditable], textarea { display: block; width: 100%; min-height: 40px; }
    article, section, user-query, model-response { display: block; padding-block: 12px; }
    .message-text { min-height: 80px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; }
    @media (max-width: 720px) { aside { display: none; } main { margin-left: 0; width: 100%; } }
  </style><aside>Native sidebar</aside><main>
    <div class="conversation">${content}</div>
    <div class="composer-column"><div class="composer-inner">${composer}</div></div>
  </main>`;

async function openFixture(t, html, host = "chatgpt.com", settings = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  // Fulfill every request locally, including the document. No real chat API.
  await context.route("**/*", route => route.fulfill({ contentType: "text/html", body: html }));
  await context.addInitScript(saved => {
    let current = saved;
    const listeners = [];
    window.chrome = {
      storage: {
        sync: { get: (_key, callback) => queueMicrotask(() => callback({ chatCanvasSettings: current })) },
        onChanged: { addListener: listener => listeners.push(listener) }
      }
    };
    window.changeSettings = patch => {
      current = { ...current, ...patch };
      listeners.forEach(listener => listener({ chatCanvasSettings: { newValue: current } }, "sync"));
    };
  }, settings);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], "content script should not throw"));
  await page.goto(`https://${host}/c/fixture`);
  await page.addStyleTag({ path: stylesheet });
  await page.addScriptTag({ path: script });
  await page.waitForFunction(() => document.documentElement.classList.contains("ccx-active"));
  return page;
}

async function waitForTurns(page, count) {
  await page.waitForFunction(expected => document.querySelectorAll(".ccx-turn").length === expected, count);
}

for (const layout of ["legacy", "rollout"]) {
  test(`${layout}: detect, widen, collapse and navigate turns`, async t => {
    const page = await openFixture(t, fixture(message("user", "A real prompt", layout) + message("assistant", "A useful reply", layout)));
    await waitForTurns(page, 2);
    assert.equal(await page.locator(".ccx-toggle").count(), 2);
    assert.deepEqual(await page.locator("#ccx-outline-host .item").allTextContents(), ["A real prompt"]);
    const widths = await page.evaluate(() => [".conversation", "#body-1", "#body-2", ".composer-column", ".composer-inner", "form"].map(selector =>
      document.querySelector(selector).getBoundingClientRect().width));
    widths.forEach(width => assert.ok(Math.abs(width - 1056) < 2, `expected 88% of the 1200px main column, got ${width}`));
    await page.locator('.ccx-user > .ccx-toggle').click();
    assert.equal(await page.locator('.ccx-user > .ccx-toggle').getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator('.ccx-user > .ccx-summary').isVisible(), true);
    assert.equal(await page.locator('#body-1').isVisible(), false);
    await page.locator('.ccx-user > .ccx-summary').click();
    assert.equal(await page.locator('#body-1').isVisible(), true);
    await page.locator("#ccx-outline-host .collapse-all").click();
    assert.equal(await page.locator(".ccx-collapsed").count(), 2);
    await page.locator("#ccx-outline-host .expand-all").click();
    assert.equal(await page.locator(".ccx-collapsed").count(), 0);
    await page.locator("#ccx-outline-host .item").click();
    assert.equal(await page.locator(".ccx-user.ccx-highlight").count(), 1);
  });
}

test("mixed legacy and rollout fallback nodes retain document order and avoid duplicate controls", async t => {
  const page = await openFixture(t, fixture(
    message("user", "First prompt", "legacy") +
    '<article><div data-chatgpt-search-unit-key="second:user" data-chatgpt-search-message-ids="second">Second prompt</div></article>' +
    '<div data-message-author-role="assistant" data-message-id="reply">Reply without a turn shell</div>' +
    '<div data-testid="conversation-turn-error">Something went wrong</div>'
  ));
  await waitForTurns(page, 3);
  assert.deepEqual(await page.locator("#ccx-outline-host .item").allTextContents(), ["First prompt", "Second prompt"]);
  assert.equal(await page.locator(".ccx-toggle").count(), 3);
  assert.equal(await page.locator('[data-testid="conversation-turn-error"].ccx-turn').count(), 0);
});

test("streaming text and late role attributes update without an observer feedback loop", async t => {
  const page = await openFixture(t, fixture('<section data-turn-key="late">Streaming prompt</section>'));
  assert.equal(await page.locator("#ccx-outline-host").count(), 0);
  await page.locator("section").evaluate(node => node.setAttribute("data-turn", "user"));
  await waitForTurns(page, 1);
  await page.evaluate(() => {
    window.outlineWrites = 0;
    const observer = new MutationObserver(() => window.outlineWrites++);
    observer.observe(document.querySelector("#ccx-outline-host").shadowRoot.querySelector(".list"), { childList: true });
    document.querySelector("section").childNodes[1].textContent = "Changed text only";
  });
  await page.waitForFunction(() => document.querySelector("#ccx-outline-host").shadowRoot.querySelector(".item").textContent === "Changed text only");
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 650)));
  assert.ok(await page.evaluate(() => window.outlineWrites) <= 2, "extension mutations must not schedule endless rebuilds");
});

test("virtualized turns preserve cached labels and collapse state when their content remounts", async t => {
  const content = (message("user", "Cached prompt") + message("assistant", "Cached reply"))
    .replaceAll(/ data-turn-id="[^"]*"/g, "");
  const page = await openFixture(t, fixture(content));
  await waitForTurns(page, 2);
  await page.locator('.ccx-user > .ccx-toggle').click();
  await page.locator('[data-turn="user"]').evaluate(node => {
    node.replaceChildren();
    node.style.height = "400px";
  });
  await page.waitForFunction(() => document.querySelector('[data-turn="user"] .ccx-summary')?.textContent === "Cached prompt");
  assert.deepEqual(await page.locator("#ccx-outline-host .item").allTextContents(), ["Cached prompt"]);
  assert.equal(await page.locator('.ccx-user > .ccx-toggle').getAttribute("aria-expanded"), "false");
  assert.ok((await page.locator(".ccx-user").boundingBox()).height < 100, "collapsed shell must release its fixed virtualized height");
  await page.locator('[data-turn="user"]').evaluate(node => node.replaceWith(node.cloneNode(false)));
  await page.waitForFunction(() => document.querySelector('[data-turn="user"] .ccx-summary')?.textContent === "Cached prompt");
  await page.locator('[data-turn="user"]').evaluate(node => {
    const content = document.createElement("div");
    content.textContent = "Remounted prompt";
    node.replaceChildren(content);
  });
  await page.waitForFunction(() => document.querySelector('[data-turn="user"] .ccx-summary')?.textContent === "Remounted prompt");
  assert.equal(await page.locator('.ccx-user > .ccx-toggle').getAttribute("aria-expanded"), "false");
  await page.locator('.ccx-user > .ccx-summary').click();
  assert.equal(await page.locator('.ccx-user').getAttribute("class").then(value => value.includes("ccx-collapsed")), false);
});

test("host renders removing extension controls and the panel restore them", async t => {
  const page = await openFixture(t, fixture(message("user", "Prompt")));
  await waitForTurns(page, 1);
  await page.evaluate(() => {
    document.querySelectorAll('.ccx-toggle, .ccx-summary, #ccx-outline-host').forEach(node => node.remove());
  });
  await page.waitForFunction(() => document.querySelector(".ccx-toggle") && document.querySelector("#ccx-outline-host"));
  assert.deepEqual(await page.locator("#ccx-outline-host .item").allTextContents(), ["Prompt"]);
});

test("SPA navigation clears previous labels and removes the outline on empty chats", async t => {
  const page = await openFixture(t, fixture(message("user", "Private old prompt")));
  await waitForTurns(page, 1);
  await page.evaluate(() => {
    history.pushState({}, "", "/c/another-chat");
    document.querySelector('.conversation').innerHTML = '<section data-turn="user" data-testid="conversation-turn-1"></section>';
  });
  await page.waitForFunction(() => document.querySelector("#ccx-outline-host").shadowRoot.querySelector(".item").textContent === "Prompt 1");
  await page.locator('.conversation').evaluate(node => node.replaceChildren());
  await page.waitForFunction(() => !document.querySelector("#ccx-outline-host"));
});

test("live preferences restore native widths, remove controls, and re-enable features", async t => {
  const page = await openFixture(t, fixture(message("user", "Prompt") + message("assistant", "Reply")));
  await waitForTurns(page, 2);
  await page.evaluate(() => window.changeSettings({ width: 100 }));
  assert.ok(Math.abs((await page.locator(".conversation").boundingBox()).width - 1200) < 2);
  await page.evaluate(() => window.changeSettings({ wideEnabled: false, collapseEnabled: false, outlineEnabled: false }));
  assert.equal(await page.locator(".ccx-toggle, .ccx-summary, #ccx-outline-host").count(), 0);
  assert.ok(Math.abs((await page.locator(".conversation").boundingBox()).width - 768) < 2);
  await page.evaluate(() => window.changeSettings({ enabled: false }));
  assert.equal(await page.locator(".ccx-turn, .ccx-wide-column, .ccx-composer-target").count(), 0);
  await page.evaluate(() => window.changeSettings({ enabled: true, wideEnabled: true, collapseEnabled: true, outlineEnabled: true }));
  await waitForTurns(page, 2);
  assert.equal(await page.locator(".ccx-toggle").count(), 2);
});

test("mobile sizing keeps the column percentage from compounding", async t => {
  const page = await openFixture(t, fixture(message("user", "Prompt") + message("assistant", "Reply")));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => Math.abs(document.querySelector(".conversation").getBoundingClientRect().width - 374) < 2);
  assert.ok(Math.abs((await page.locator("#body-1").boundingBox()).width - 374) < 2);
  assert.ok(Math.abs((await page.locator("form").boundingBox()).width - 374) < 2);
});

test("mobile fallback turns use the available column width", async t => {
  const page = await openFixture(t, fixture('<div data-message-author-role="user" data-message-id="mobile-prompt">Prompt without a shell</div>'));
  await page.locator('.conversation').evaluate(node => node.style.maxWidth = "none");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => Math.abs(document.querySelector(".ccx-turn").getBoundingClientRect().width - 374) < 2);
});

test("repeated generic test IDs do not share labels or collapse state", async t => {
  const page = await openFixture(t, fixture(
    '<div data-testid="user-message">First Claude prompt</div><div data-testid="user-message">Second Claude prompt</div>'
  ), "claude.ai");
  await waitForTurns(page, 2);
  assert.deepEqual(await page.locator("#ccx-outline-host .item").allTextContents(), ["First Claude prompt", "Second Claude prompt"]);
  await page.locator('.ccx-user > .ccx-toggle').first().click();
  await page.evaluate(() => window.changeSettings({ width: 90 }));
  assert.equal(await page.locator(".ccx-collapsed").count(), 1);
  assert.equal(await page.locator(".ccx-collapsed > .ccx-summary").textContent(), "First Claude prompt");
});

for (const [host, turns, composer] of [
  ["claude.ai", '<div data-test-render-count="1"><div data-testid="user-message">Claude prompt</div></div><div data-test-render-count="2"><div class="font-claude-response">Claude answer</div></div>', '<div data-testid="chat-input" contenteditable="true"></div>'],
  ["gemini.google.com", '<user-query>Gemini prompt</user-query><model-response>Gemini answer</model-response>', '<rich-textarea><div contenteditable="true"></div></rich-textarea>']
]) {
  test(`${host}: existing message detection and controls still work`, async t => {
    const page = await openFixture(t, fixture(turns, composer), host);
    await waitForTurns(page, 2);
    assert.equal(await page.locator(".ccx-user").count(), 1);
    assert.equal(await page.locator(".ccx-assistant").count(), 1);
    assert.equal(await page.locator(".ccx-toggle").count(), 2);
    assert.equal(await page.locator("#ccx-outline-host .item").count(), 1);
  });
}
