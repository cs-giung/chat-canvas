"use strict";

const DEFAULTS = {
  enabled: true,
  wideEnabled: true,
  width: 88,
  collapseEnabled: true,
  outlineEnabled: true,
  sites: { chatgpt: true, claude: true, gemini: true }
};

const ids = [
  "enabled",
  "wideEnabled",
  "width",
  "collapseEnabled",
  "outlineEnabled"
];
const controls = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const siteControls = Object.fromEntries(
  Object.keys(DEFAULTS.sites).map((site) => [site, document.getElementById(`site-${site}`)])
);
const widthValue = document.getElementById("widthValue");
const widthRow = document.getElementById("widthRow");
const status = document.getElementById("status");
let saveTimer = 0;
let statusTimer = 0;

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

function readForm() {
  return {
    enabled: controls.enabled.checked,
    wideEnabled: controls.wideEnabled.checked,
    width: Number(controls.width.value),
    collapseEnabled: controls.collapseEnabled.checked,
    outlineEnabled: controls.outlineEnabled.checked,
    sites: Object.fromEntries(
      Object.entries(siteControls).map(([site, input]) => [site, input.checked])
    )
  };
}

function render(settings) {
  for (const key of ids) {
    const control = controls[key];
    if (control.type === "checkbox") control.checked = Boolean(settings[key]);
    else control.value = settings[key];
  }
  for (const [site, control] of Object.entries(siteControls)) {
    control.checked = settings.sites[site] !== false;
  }
  refreshDependencies();
}

function refreshDependencies() {
  widthValue.textContent = `${controls.width.value}%`;
  controls.width.disabled = !controls.wideEnabled.checked;
  widthRow.classList.toggle("disabled", !controls.wideEnabled.checked);
}

function announce(message) {
  clearTimeout(statusTimer);
  status.textContent = message;
  statusTimer = setTimeout(() => {
    status.textContent = "Changes apply instantly";
  }, 1300);
}

function save(immediate = false) {
  clearTimeout(saveTimer);
  const commit = () => {
    chrome.storage.sync.set({ chatCanvasSettings: readForm() }, () => {
      announce(chrome.runtime.lastError ? "Could not save" : "Saved");
    });
  };
  if (immediate) commit();
  else saveTimer = setTimeout(commit, 100);
}

for (const control of Object.values(controls)) {
  control.addEventListener(control.type === "range" ? "input" : "change", () => {
    refreshDependencies();
    save(control.type !== "range");
  });
}
for (const control of Object.values(siteControls)) {
  control.addEventListener("change", () => save(true));
}

document.getElementById("reset").addEventListener("click", () => {
  render(DEFAULTS);
  save(true);
  announce("Reset to defaults");
});

chrome.storage.sync.get("chatCanvasSettings", (result) => {
  render(mergeSettings(result.chatCanvasSettings));
});
