(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    wideEnabled: true,
    width: 88,
    collapseEnabled: true,
    outlineEnabled: true,
    sites: { chatgpt: true, claude: true, gemini: true }
  };

  const SITE_CONFIG = {
    chatgpt: {
      host: "chatgpt.com",
      turns: [
        'article[data-testid^="conversation-turn-"]',
        '[data-testid^="conversation-turn-"]',
        '[data-message-role="user"]',
        '[data-message-role="assistant"]'
      ],
      users: [
        '[data-message-author-role="user"]',
        '[data-message-role="user"]'
      ],
      assistants: [
        '[data-message-author-role="assistant"]',
        '[data-message-role="assistant"]'
      ],
      composers: [
        'form[data-type="composer"]',
        '#prompt-textarea',
        'form[data-mobile-composer]'
      ]
    },
    claude: {
      host: "claude.ai",
      turns: [
        '[data-test-render-count]:has([data-testid="user-message"])',
        '[data-test-render-count]:has(.font-user-message)',
        '[data-test-render-count]:has(.font-claude-response)',
        '[data-test-render-count]:has(.font-claude-message)',
        '[data-test-render-count]:has([data-is-streaming])',
        '[data-test-render-count]:has([data-testid="file-thumbnail"]):not(:has(.font-claude-response, .font-claude-message, [data-is-streaming]))',
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '[data-is-streaming]'
      ],
      users: [
        '[data-testid="user-message"]',
        '.font-user-message'
      ],
      assistants: [
        '[data-testid="assistant-message"]',
        '.font-claude-response',
        '.font-claude-message',
        '[data-is-streaming]'
      ],
      composers: [
        '[data-testid="chat-input"]',
        'div[contenteditable="true"].ProseMirror'
      ]
    },
    gemini: {
      host: "gemini.google.com",
      turns: ['user-query', 'model-response'],
      users: ['user-query'],
      assistants: ['model-response'],
      composers: [
        'rich-textarea div[contenteditable="true"]',
        '.input-area-container'
      ]
    }
  };

  const siteKey = Object.keys(SITE_CONFIG).find(
    (key) => location.hostname === SITE_CONFIG[key].host
  );
  if (!siteKey) return;

  const config = SITE_CONFIG[siteKey];
  const state = {
    settings: structuredClone(DEFAULTS),
    observer: null,
    rebuildTimer: 0,
    panelHost: null,
    panelShadow: null,
    outlineList: null,
    turnNumber: 0
  };

  const queryAll = (selectors, root = document) => {
    const results = [];
    for (const selector of selectors) {
      try {
        results.push(...root.querySelectorAll(selector));
      } catch (_) {
        // Ignore a selector if a host app temporarily renders invalid markup.
      }
    }
    return [...new Set(results)];
  };

  const matchesAny = (element, selectors) =>
    selectors.some((selector) => {
      try {
        return element.matches(selector) || Boolean(element.querySelector(selector));
      } catch (_) {
        return false;
      }
    });

  function mergeSettings(saved = {}) {
    const boolean = (value, fallback) =>
      typeof value === "boolean" ? value : fallback;
    const savedWidth = Number(saved.width);

    return {
      enabled: boolean(saved.enabled, DEFAULTS.enabled),
      wideEnabled: boolean(saved.wideEnabled, DEFAULTS.wideEnabled),
      width: Number.isFinite(savedWidth)
        ? Math.min(100, Math.max(55, Math.round(savedWidth)))
        : DEFAULTS.width,
      collapseEnabled: boolean(saved.collapseEnabled, DEFAULTS.collapseEnabled),
      outlineEnabled: boolean(saved.outlineEnabled, DEFAULTS.outlineEnabled),
      sites: Object.fromEntries(
        Object.entries(DEFAULTS.sites).map(([site, fallback]) => [
          site,
          boolean(saved.sites?.[site], fallback)
        ])
      )
    };
  }

  function isActive() {
    return state.settings.enabled && state.settings.sites[siteKey] !== false;
  }

  function setPageState() {
    const root = document.documentElement;
    const active = isActive();
    root.classList.toggle("ccx-active", active);
    root.classList.toggle("ccx-wide", active && state.settings.wideEnabled);
    root.style.setProperty("--ccx-content-width", `${state.settings.width}%`);

    if (!active) {
      removePanel();
      clearWideTargets();
      document.querySelectorAll(".ccx-turn").forEach(cleanTurn);
      return;
    }

    processPage();
  }

  function getTurnRoots() {
    const roots = queryAll(config.turns).filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      return !element.parentElement?.closest(config.turns.join(","));
    });

    // ChatGPT occasionally moves the stable role attribute outside the turn
    // test id. This fallback keeps the extension useful during DOM rollouts.
    if (siteKey === "chatgpt" && roots.length === 0) {
      return queryAll([...config.users, ...config.assistants])
        .map((node) => node.closest("article") || node.parentElement)
        .filter(Boolean);
    }
    return [...new Set(roots)];
  }

  function classifyTurn(root) {
    if (matchesAny(root, config.users)) return "user";
    if (matchesAny(root, config.assistants)) return "assistant";
    if (
      siteKey === "claude" &&
      root.querySelector('[data-testid="file-thumbnail"]')
    ) return "user";
    if (siteKey === "gemini") {
      if (root.matches("user-query")) return "user";
      if (root.matches("model-response")) return "assistant";
    }
    return "unknown";
  }

  function cleanText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll?.(
      '.ccx-toggle, .ccx-summary, script, style, [aria-hidden="true"], .sr-only, [class*="srOnly"], [class*="sr-only"]'
    ).forEach((node) => node.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function makeTitle(root, index) {
    const text = cleanText(root);
    if (!text) return `Prompt ${index + 1}`;
    return text.length > 90 ? `${text.slice(0, 87)}…` : text;
  }

  function ensureTurn(root, role) {
    root.classList.add("ccx-turn", `ccx-${role}`);
    if (!root.dataset.ccxId) {
      state.turnNumber += 1;
      root.dataset.ccxId = `ccx-turn-${state.turnNumber}`;
    }

    if ((role === "assistant" || role === "user") && state.settings.collapseEnabled) {
      ensureCollapseControl(root);
    } else {
      root.querySelectorAll(":scope > .ccx-toggle, :scope > .ccx-summary")
        .forEach((node) => node.remove());
      root.classList.remove("ccx-collapsed");
    }
  }

  function ensureCollapseControl(root) {
    let toggle = root.querySelector(":scope > .ccx-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ccx-toggle";
      toggle.title = "Collapse message";
      toggle.setAttribute("aria-label", "Collapse message");
      toggle.setAttribute("aria-expanded", "true");
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setCollapsed(root, !root.classList.contains("ccx-collapsed"));
      });
      root.prepend(toggle);
    }

    let summary = root.querySelector(":scope > .ccx-summary");
    if (!summary) {
      summary = document.createElement("button");
      summary.type = "button";
      summary.className = "ccx-summary";
      summary.addEventListener("click", () => setCollapsed(root, false));
      root.append(summary);
    }
    updateSummary(root);
  }

  function updateSummary(root) {
    const summary = root.querySelector(":scope > .ccx-summary");
    if (!summary || root.classList.contains("ccx-collapsed")) return;
    const text = cleanText(root);
    summary.textContent = text
      ? `${text.slice(0, 110)}${text.length > 110 ? "…" : ""}`
      : "Collapsed message";
  }

  function setCollapsed(root, collapsed) {
    root.classList.toggle("ccx-collapsed", collapsed);
    const toggle = root.querySelector(":scope > .ccx-toggle");
    if (toggle) {
      toggle.title = collapsed ? "Expand message" : "Collapse message";
      toggle.setAttribute("aria-label", toggle.title);
      toggle.setAttribute("aria-expanded", String(!collapsed));
    }
    if (!collapsed) updateSummary(root);
  }

  function cleanTurn(root) {
    root.classList.remove(
      "ccx-turn",
      "ccx-user",
      "ccx-assistant",
      "ccx-unknown",
      "ccx-collapsed",
      "ccx-wide-target",
      "ccx-wide-column"
    );
    root.querySelectorAll(":scope > .ccx-toggle, :scope > .ccx-summary")
      .forEach((node) => node.remove());
    delete root.dataset.ccxId;
  }

  function clearWideTargets() {
    document.querySelectorAll(".ccx-wide-target, .ccx-wide-column, .ccx-composer-target")
      .forEach((node) =>
        node.classList.remove("ccx-wide-target", "ccx-wide-column", "ccx-composer-target")
      );
  }

  function markWideTargets(turns) {
    clearWideTargets();
    if (!state.settings.wideEnabled) return;

    const findConstrainedColumns = (start) => {
      const constrained = [];
      let candidate = start;
      for (let depth = 0; candidate && depth < 10; depth += 1) {
        if (candidate === document.body || candidate.tagName === "MAIN") break;
        const style = getComputedStyle(candidate);
        const maxWidth = style.maxWidth;
        const pixels = maxWidth.endsWith("px") ? Number.parseFloat(maxWidth) : NaN;
        const rect = candidate.getBoundingClientRect();
        const parentRect = candidate.parentElement?.getBoundingClientRect();
        const sideGap = parentRect ? parentRect.width - rect.width : 0;
        const centerOffset = parentRect
          ? Math.abs(
              rect.left + rect.width / 2 -
              (parentRect.left + parentRect.width / 2)
            )
          : Infinity;
        const centeredAndNarrow =
          rect.width >= 320 && sideGap >= 48 && centerOffset <= 4;
        const hasPixelLimit =
          Number.isFinite(pixels) && pixels >= 320 && pixels < innerWidth * 0.96;

        if (hasPixelLimit || centeredAndNarrow) constrained.push(candidate);
        candidate = candidate.parentElement;
      }
      return constrained;
    };

    const columns = new Set();
    for (const root of turns) {
      root.classList.add("ccx-wide-target");
      // The classic ChatGPT layout constrains a wrapper directly inside each
      // turn. Do not apply this broadly: on other layouts the first native
      // child can be the colored user bubble itself.
      if (
        siteKey === "chatgpt" &&
        root.matches('[data-testid^="conversation-turn-"]')
      ) {
        const messageWrapper = root.querySelector(
          ":scope > :not(.ccx-toggle):not(.ccx-summary)"
        );
        if (messageWrapper instanceof HTMLElement) {
          messageWrapper.classList.add("ccx-wide-target");
        }
      }

      // Some hosts (notably Claude) stack multiple centered max-width
      // wrappers. Apply the configured percentage once to the outermost
      // constraint, then let every inner constraint fill that column.
      const constrained = findConstrainedColumns(root.parentElement);
      if (constrained.length) {
        constrained.slice(0, -1).forEach((element) =>
          element.classList.add("ccx-wide-target")
        );
        columns.add(constrained.at(-1));
      } else {
        columns.add(root);
      }
    }
    columns.forEach((column) => column.classList.add("ccx-wide-column"));

    for (const composer of queryAll(config.composers)) {
      const anchor = composer.closest("form") || composer;
      const constrained = findConstrainedColumns(anchor);
      if (constrained.length) {
        constrained.slice(0, -1).forEach((element) =>
          element.classList.add("ccx-wide-target")
        );
        constrained.at(-1).classList.add("ccx-composer-target");
      } else {
        anchor.classList.add("ccx-composer-target");
      }
    }
  }

  function createPanel() {
    if (state.panelHost || !state.settings.outlineEnabled || !isActive()) return;
    const host = document.createElement("div");
    host.id = "ccx-outline-host";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .panel {
          --panel-bg: rgba(255,255,255,.96);
          --panel-fg: #202123;
          --panel-muted: #6b7280;
          --panel-border: rgba(0,0,0,.12);
          position: fixed; z-index: 2147483646; right: 16px; top: 76px;
          width: min(280px, calc(100vw - 32px)); max-height: calc(100vh - 100px);
          display: flex; flex-direction: column; overflow: hidden;
          color: var(--panel-fg); background: var(--panel-bg);
          border: 1px solid var(--panel-border); border-radius: 14px;
          box-shadow: 0 12px 36px rgba(0,0,0,.16);
          font: 13px/1.35 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          backdrop-filter: blur(14px);
        }
        @media (prefers-color-scheme: dark) {
          .panel { --panel-bg: rgba(35,35,38,.95); --panel-fg: #f4f4f5;
            --panel-muted: #a1a1aa; --panel-border: rgba(255,255,255,.14); }
        }
        .header { display:flex; align-items:center; gap:8px; padding:11px 12px;
          border-bottom:1px solid var(--panel-border); font-weight:700; }
        .count { color:var(--panel-muted); font-weight:500; }
        .spacer { flex:1; }
        button { font:inherit; color:inherit; }
        .icon { width:26px; height:26px; border:0; border-radius:7px; background:transparent;
          cursor:pointer; font-size:18px; line-height:1; }
        .icon:hover, .action:hover { background:rgba(127,127,127,.14); }
        .actions { display:flex; gap:6px; padding:8px; border-bottom:1px solid var(--panel-border); }
        .actions.hidden { display:none; }
        .action { flex:1; border:1px solid var(--panel-border); border-radius:8px;
          background:transparent; cursor:pointer; padding:6px 4px; }
        .list { margin:0; padding:6px; list-style:none; overflow:auto; }
        .item { display:block; width:100%; box-sizing:border-box; border:0; border-radius:8px;
          padding:7px 8px; text-align:left; background:transparent; cursor:pointer;
          color:var(--panel-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .item:hover { color:var(--panel-fg); background:rgba(127,127,127,.12); }
        .item.active { color:var(--panel-fg); background:rgba(16,163,127,.16); }
        .empty { color:var(--panel-muted); padding:14px 9px; text-align:center; }
        .panel.minimized { width:auto; min-width:150px; }
        .panel.minimized .actions, .panel.minimized .list { display:none; }
        .panel.minimized .header { border-bottom:0; padding:8px 10px; }
      </style>
      <aside class="panel" aria-label="Conversation outline">
        <div class="header">
          <span class="title">Outline</span><span class="count"></span><span class="spacer"></span>
          <button class="icon minimize" title="Minimize outline" aria-label="Minimize outline">−</button>
        </div>
        <div class="actions">
          <button class="action collapse-all">Collapse all</button>
          <button class="action expand-all">Expand all</button>
        </div>
        <ol class="list"></ol>
      </aside>`;

    shadow.querySelector(".collapse-all").addEventListener("click", () =>
      document.querySelectorAll(".ccx-user, .ccx-assistant")
        .forEach((root) => setCollapsed(root, true))
    );
    shadow.querySelector(".expand-all").addEventListener("click", () =>
      document.querySelectorAll(".ccx-user, .ccx-assistant")
        .forEach((root) => setCollapsed(root, false))
    );
    shadow.querySelector(".minimize").addEventListener("click", (event) => {
      const panel = shadow.querySelector(".panel");
      const minimized = panel.classList.toggle("minimized");
      event.currentTarget.textContent = minimized ? "+" : "−";
      event.currentTarget.title = minimized ? "Expand outline" : "Minimize outline";
      event.currentTarget.setAttribute("aria-label", event.currentTarget.title);
    });

    document.documentElement.append(host);
    state.panelHost = host;
    state.panelShadow = shadow;
    state.outlineList = shadow.querySelector(".list");
  }

  function removePanel() {
    state.panelHost?.remove();
    state.panelHost = null;
    state.panelShadow = null;
    state.outlineList = null;
  }

  function updateOutline(turns) {
    if (!state.settings.outlineEnabled || turns.length === 0) {
      removePanel();
      return;
    }
    createPanel();
    if (!state.outlineList) return;

    const users = turns.filter((root) => classifyTurn(root) === "user");
    state.outlineList.replaceChildren();
    state.panelShadow.querySelector(".count").textContent = users.length ? `(${users.length})` : "";
    state.panelShadow.querySelector(".actions").classList.toggle(
      "hidden",
      !state.settings.collapseEnabled
    );

    if (!users.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "Prompts will appear here";
      state.outlineList.append(empty);
      return;
    }

    users.forEach((root, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "item";
      button.textContent = makeTitle(root, index);
      button.title = button.textContent;
      button.addEventListener("click", () => {
        root.scrollIntoView({ behavior: "smooth", block: "start" });
        root.classList.add("ccx-highlight");
        setTimeout(() => root.classList.remove("ccx-highlight"), 1200);
      });
      item.append(button);
      state.outlineList.append(item);
    });
    updateActiveOutline(users);
  }

  function updateActiveOutline(users = null) {
    if (!state.outlineList) return;
    users ||= getTurnRoots().filter((root) => classifyTurn(root) === "user");
    if (!users.length) return;
    const marker = Math.min(240, innerHeight * 0.35);
    let activeIndex = 0;
    users.forEach((root, index) => {
      if (root.getBoundingClientRect().top <= marker) activeIndex = index;
    });
    state.outlineList.querySelectorAll(".item").forEach((item, index) =>
      item.classList.toggle("active", index === activeIndex)
    );
  }

  function processPage() {
    if (!isActive()) return;
    const turns = getTurnRoots();
    turns.forEach((root) => ensureTurn(root, classifyTurn(root)));
    markWideTargets(turns);
    updateOutline(turns);
  }

  function scheduleProcess() {
    clearTimeout(state.rebuildTimer);
    state.rebuildTimer = setTimeout(processPage, 180);
  }

  function start() {
    chrome.storage.sync.get("chatCanvasSettings", (result) => {
      state.settings = mergeSettings(result.chatCanvasSettings);
      setPageState();
    });

    state.observer = new MutationObserver((mutations) => {
      if (!isActive()) return;
      const meaningful = mutations.some((mutation) =>
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          (node) => node.nodeType === Node.ELEMENT_NODE &&
            !(node instanceof HTMLElement && node.closest?.("#ccx-outline-host"))
        )
      );
      if (meaningful) scheduleProcess();
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    let scrollQueued = false;
    addEventListener("scroll", () => {
      if (scrollQueued || !isActive()) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        updateActiveOutline();
        scrollQueued = false;
      });
    }, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes.chatCanvasSettings) return;
      state.settings = mergeSettings(changes.chatCanvasSettings.newValue);
      setPageState();
    });
  }

  start();
})();
