(() => {
  "use strict";

  const escape = text => text.replace(/\\/g, "\\\\").replace(/([`*_[\]<>])/g, "\\$1")
    .replace(/^(\s*)(#{1,6}|>|[-+] |\d+\. )/gm, "$1\\$2");
  const safeUrl = value => /^(https?:|mailto:)/i.test(value || "") ? value : "";
  const inline = text => text.replace(/\s+/g, " ");
  const block = text => `\n\n${text.trim()}\n\n`;

  function convert(root, preserveLines = false) {
    function children(node) {
      return [...node.childNodes].map(render).join("");
    }
    function render(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = preserveLines ? node.textContent.replace(/\r\n?/g, "\n") : inline(node.textContent);
        return escape(text);
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName.toLowerCase();
      if (node.matches('button, script, style, svg, nav, [aria-hidden="true"], .sr-only, [class*="srOnly"], [class*="sr-only"], .ccx-toggle, .ccx-summary, .cdk-visually-hidden')) return "";

      // Read TeX before discarding KaTeX's hidden duplicate presentation.
      const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent ||
        node.getAttribute("data-math") || node.getAttribute("data-formula");
      if (tex && (node.matches('.katex-display, .katex, math, [data-math], [data-formula]'))) {
        return node.matches('.katex-display, [display="block"]')
          ? block(`$$\n${tex.trim()}\n$$`) : `$${tex.trim()}$`;
      }
      if (tag === "pre") {
        const code = node.querySelector("code") || node;
        const raw = code.textContent.replace(/\n$/, "");
        const runs = raw.match(/`+/g) || [];
        const fence = "`".repeat(Math.max(3, ...runs.map(run => run.length + 1)));
        const language = (code.className.match(/(?:language|lang)-([\w+-]+)/)?.[1] ||
          node.getAttribute("data-language") || "").replace(/[^\w+-]/g, "");
        return block(`${fence}${language}\n${raw}\n${fence}`);
      }
      if (tag === "code") {
        const raw = inline(node.textContent);
        const fence = "`".repeat(Math.max(1, ...(raw.match(/`+/g) || []).map(run => run.length + 1)));
        const pad = /^[` ]|[` ]$/.test(raw) ? " " : "";
        return `${fence}${pad}${raw}${pad}${fence}`;
      }
      if (tag === "br") return "  \n";
      if (tag === "hr") return block("---");
      if (tag === "img") {
        const src = safeUrl(node.getAttribute("src"));
        const alt = escape(node.getAttribute("alt") || "Image");
        return src ? `![${alt}](<${encodeURI(src).replace(/>/g, "%3E")}>)` : `[${alt}]`;
      }
      if (tag === "table") {
        const rows = [...node.rows].map(row => [...row.cells].map(cell =>
          children(cell).trim().replace(/\n+/g, "<br>").replace(/\|/g, "\\|")));
        if (!rows.length) return "";
        const width = Math.max(...rows.map(row => row.length));
        const row = cells => `| ${Array.from({ length: width }, (_, i) => cells[i] || "").join(" | ")} |`;
        return block([row(rows[0]), row(Array(width).fill("---")), ...rows.slice(1).map(row)].join("\n"));
      }
      if (tag === "ul" || tag === "ol") {
        const start = Number(node.getAttribute("start")) || 1;
        return block([...node.children].filter(child => child.tagName === "LI").map((li, index) => {
          const marker = tag === "ol" ? `${start + index}. ` : "- ";
          const text = children(li).trim();
          return marker + text.replace(/\n/g, `\n${" ".repeat(marker.length)}`);
        }).join("\n"));
      }
      const text = children(node);
      if (/^h[1-6]$/.test(tag)) return block(`${"#".repeat(Number(tag[1]))} ${text.trim()}`);
      if (tag === "strong" || tag === "b") return text.trim() ? `**${text.trim()}**` : text;
      if (tag === "em" || tag === "i") return text.trim() ? `*${text.trim()}*` : text;
      if (tag === "del" || tag === "s") return `~~${text}~~`;
      if (tag === "a") {
        const href = safeUrl(node.href);
        return href ? `[${text.trim() || escape(href)}](<${encodeURI(href).replace(/>/g, "%3E")}>)` : text;
      }
      if (tag === "blockquote") return block(text.trim().split("\n").map(line => `> ${line}`).join("\n"));
      if (["p", "div", "section", "article"].includes(tag)) return block(text);
      return text;
    }
    return render(root).trim();
  }

  function message(root, site, role) {
    // Clone rather than expand messages: collapsed content remains exportable,
    // and no live page state or native controls are modified during export.
    const clone = root.cloneNode(true);
    clone.querySelectorAll('button, script, style, svg, .ccx-toggle, .ccx-summary').forEach(node => node.remove());
    const selectors = site === "gemini"
      ? (role === "user" ? [".query-text", ".query-content"] : ["message-content .markdown", "message-content", ".markdown-main-panel", ".response-content"])
      : (role === "user" ? ["[data-user-message-bubble]", '[data-message-author-role="user"]', '[data-message-role="user"]', '[data-chatgpt-search-unit-key$=":user"]']
        : [".markdown", '[data-markdown-text-style="assistant-message"]', '[data-message-author-role="assistant"]', '[data-message-role="assistant"]', '[data-chatgpt-search-unit-key$=":assistant"]']);
    for (const selector of selectors) {
      const nodes = clone.matches(selector) ? [clone] : [...clone.querySelectorAll(selector)];
      // A preferred hook can be an empty streaming/virtualized placeholder.
      // Try the next content selector instead of dropping the entire reply.
      const text = nodes.map(node => convert(node, role === "user")).filter(Boolean).join("\n\n");
      if (text) return text;
    }
    // Native response toolbars/thinking panels are not message contents.
    clone.querySelectorAll('h5, response-container-header, model-thoughts, .response-footer, .response-container-header, .query-actions, .response-actions').forEach(node => node.remove());
    return convert(clone, role === "user");
  }

  function conversation(turns, { site, title, url }) {
    const heading = (title || (site === "gemini" ? "Gemini conversation" : "ChatGPT conversation")).replace(/\s+/g, " ").trim();
    const sections = [];
    let skipped = 0;
    for (const { root, role } of turns) {
      const text = message(root, site, role);
      if (!text) { skipped++; continue; }
      sections.push(`## ${role === "user" ? "User" : site === "gemini" ? "Gemini" : "ChatGPT"}\n\n${text}`);
    }
    const filename = heading.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-").replace(/[. ]+$/g, "").slice(0, 120) || "conversation";
    return {
      count: sections.length, skipped, filename: `${filename}.md`,
      markdown: `# ${escape(heading)}\n\nSource: ${url}\n\n> Exported from currently loaded messages. Unloaded history and attachments may be omitted.\n\n${sections.join("\n\n---\n\n")}\n`
    };
  }

  globalThis.ChatCanvasMarkdown = Object.freeze({ conversation });
})();
