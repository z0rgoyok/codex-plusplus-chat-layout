/**
 * Chat Layout
 *
 * Repositions Codex's centered chat column using a small renderer-only
 * controller. The tweak annotates likely chat/composer width containers and
 * lets CSS own the actual layout override.
 */

const STYLE_ID = "codexpp-chat-layout-style";
const ROOT_ATTR = "data-codexpp-chat-layout";
const TARGET_ATTR = "data-codexpp-chat-layout-target";
const STORAGE_KEY = "layout";

const DEFAULT_LAYOUT = Object.freeze({
  enabled: true,
  offset: 24,
  width: 960,
  handles: false,
});

const LIMITS = Object.freeze({
  minOffset: 0,
  maxOffset: 1200,
  minWidth: 520,
  maxWidth: 1600,
  rightGutter: 24,
});

const ASIDE_SELECTOR = [
  "aside.pointer-events-auto.relative.flex.overflow-hidden",
  "aside.pointer-events-auto.relative.flex.overflow-visible",
  "aside.pointer-events-auto.relative.flex",
].join(", ");

/** @type {import("@codex-plusplus/sdk").Tweak} */
module.exports = {
  start(api) {
    if (api.process === "main") return;
    startRenderer(this, api);
  },

  stop() {
    const state = this._state;
    if (!state) return;
    state.disposed = true;
    state.observer?.disconnect();
    state.sidebarResizeObserver?.disconnect();
    window.removeEventListener("resize", state.onResize, true);
    document.querySelectorAll(`[${TARGET_ATTR}="true"]`).forEach((node) => {
      node.removeAttribute(TARGET_ATTR);
    });
    state.style?.remove();
    state.handleLayer?.remove();
    state.pageHandle?.unregister();
    this._state = null;
  },
};

function startRenderer(self, api) {
  const state = {
    api,
    disposed: false,
    layout: normalizeLayout(api.storage.get(STORAGE_KEY, DEFAULT_LAYOUT)),
    style: installStyle(),
    handleLayer: null,
    pageHandle: null,
    observer: null,
    sidebarResizeObserver: null,
    observedSidebar: null,
    scheduled: 0,
    onResize: null,
  };
  self._state = state;

  state.onResize = () => scheduleApply(state);

  window.addEventListener("resize", state.onResize, true);
  state.observer = new MutationObserver(() => scheduleApply(state));
  state.observer.observe(document.documentElement, { childList: true, subtree: true });

  if (typeof api.settings?.registerPage === "function") {
    state.pageHandle = api.settings.registerPage({
      id: "main",
      title: "Chat Layout",
      description: "Adjust Codex chat alignment and width.",
      iconSvg:
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M4 5.5h12M4 10h9M4 14.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M2.75 3v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        "</svg>",
      render: (root) => renderSettings(root, state),
    });
  }

  applyLayout(state);
}

function scheduleApply(state) {
  if (state.disposed || state.scheduled) return;
  state.scheduled = window.requestAnimationFrame(() => {
    state.scheduled = 0;
    applyLayout(state);
  });
}

function applyLayout(state) {
  if (state.disposed) return;
  state.layout = normalizeLayout(state.layout);
  writeCss(state);
  trackSidebar(state);
  annotateTargets(state);
  renderHandles(state);
  renderSettings(state.pageRoot, state);
}

function trackSidebar(state) {
  const sidebar = findMainSidebar();
  if (state.observedSidebar === sidebar) return;
  state.sidebarResizeObserver?.disconnect();
  state.sidebarResizeObserver = null;
  state.observedSidebar = sidebar;
  if (!sidebar || typeof ResizeObserver !== "function") return;
  state.sidebarResizeObserver = new ResizeObserver(() => scheduleApply(state));
  state.sidebarResizeObserver.observe(sidebar);
}

function writeCss(state) {
  const { enabled, offset, width } = state.layout;
  state.style.textContent = `
    :root {
      --codexpp-chat-layout-offset: ${offset}px;
      --codexpp-chat-layout-width: ${width}px;
    }

    [${TARGET_ATTR}="true"] {
      ${enabled ? `
      --codexpp-chat-layout-target-offset: var(--codexpp-chat-layout-offset);
      --codexpp-chat-layout-effective-width: min(
        var(--codexpp-chat-layout-width),
        calc(100vw - var(--codexpp-chat-layout-target-offset) - ${LIMITS.rightGutter}px)
      );
      width: max(${LIMITS.minWidth}px, var(--codexpp-chat-layout-effective-width)) !important;
      max-width: max(${LIMITS.minWidth}px, var(--codexpp-chat-layout-effective-width)) !important;
      margin-left: var(--codexpp-chat-layout-target-offset) !important;
      margin-right: auto !important;
      ` : ""}
    }

    [${ROOT_ATTR}="settings"] {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    [${ROOT_ATTR}="card"] {
      border: 1px solid var(--color-token-border, rgb(0 0 0 / 0.12));
      border-radius: 8px;
      background: var(--color-token-main-surface-primary, Canvas);
      overflow: hidden;
    }

    [${ROOT_ATTR}="row"] {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) minmax(220px, 1.4fr) 88px;
      gap: 16px;
      align-items: center;
      padding: 14px 16px;
      border-top: 1px solid var(--color-token-border, rgb(0 0 0 / 0.1));
    }

    [${ROOT_ATTR}="row"]:first-child {
      border-top: 0;
    }

    [${ROOT_ATTR}="label"] {
      font-weight: 600;
    }

    [${ROOT_ATTR}="description"] {
      color: var(--color-token-text-secondary, color-mix(in srgb, currentColor 65%, transparent));
      font-size: 12px;
      line-height: 1.35;
      margin-top: 2px;
    }

    [${ROOT_ATTR}="range"] {
      width: 100%;
    }

    [${ROOT_ATTR}="number"] {
      width: 88px;
      border: 1px solid var(--color-token-border, rgb(0 0 0 / 0.16));
      border-radius: 6px;
      padding: 6px 8px;
      background: var(--color-token-main-surface-secondary, Canvas);
      color: inherit;
      font: inherit;
    }

    [${ROOT_ATTR}="actions"] {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    [${ROOT_ATTR}="button"] {
      border: 1px solid var(--color-token-border, rgb(0 0 0 / 0.16));
      border-radius: 6px;
      padding: 7px 10px;
      background: var(--color-token-main-surface-secondary, Canvas);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
  `;
}

function annotateTargets(state) {
  document.querySelectorAll(`[${TARGET_ATTR}="true"]`).forEach((node) => {
    node.removeAttribute(TARGET_ATTR);
    node.style?.removeProperty("--codexpp-chat-layout-target-offset");
  });
  if (!state.layout.enabled) return;

  const sidebarRight = mainSidebarRight();
  for (const node of findLayoutTargets()) {
    node.setAttribute(TARGET_ATTR, "true");
    node.style.setProperty(
      "--codexpp-chat-layout-target-offset",
      `${targetOffsetFor(node, state.layout.offset, sidebarRight)}px`,
    );
  }
}

function findLayoutTargets(root = document) {
  const targets = new Set();
  const inputs = findComposerInputs(root);
  for (const input of inputs) {
    for (const node of rankedWidthAncestors(input)) {
      targets.add(node);
    }
  }

  const messageNodes = Array.from(root.querySelectorAll?.([
    "[data-turn-key]",
    "article",
    "[data-message-author-role]",
  ].join(",")) || []);
  for (const message of messageNodes) {
    for (const node of rankedWidthAncestors(message)) {
      targets.add(node);
    }
  }

  return Array.from(targets).filter((node) => node instanceof HTMLElement && visible(node));
}

function rankedWidthAncestors(node) {
  const out = [];
  const viewport = window.innerWidth || 0;
  for (let current = node; current && current !== document.body; current = current.parentElement) {
    if (!(current instanceof HTMLElement)) continue;
    const rect = current.getBoundingClientRect();
    if (!looksLikeContentColumn(current, rect, viewport)) continue;
    out.push(current);
  }
  out.sort((a, b) => scoreTarget(b) - scoreTarget(a));
  return out.slice(0, 2);
}

function looksLikeContentColumn(node, rect, viewport) {
  if (rect.width < LIMITS.minWidth || rect.width > LIMITS.maxWidth + 240) return false;
  if (rect.height < 20) return false;
  if (rect.left < 40 || rect.right > viewport + 2) return false;
  const className = String(node.className || "");
  const text = `${className} ${node.getAttribute("data-testid") || ""}`;
  return /max-w|mx-auto|container|composer|thread|conversation|message|content/i.test(text) ||
    Boolean(node.querySelector?.("textarea, [role='textbox'], [data-turn-key], article, [data-message-author-role]"));
}

function scoreTarget(node) {
  const rect = node.getBoundingClientRect();
  const className = String(node.className || "");
  let score = 0;
  if (/max-w/.test(className)) score += 8;
  if (/mx-auto/.test(className)) score += 7;
  if (/composer/i.test(className)) score += 4;
  if (node.querySelector?.("textarea, [role='textbox']")) score += 4;
  if (node.querySelector?.("[data-turn-key], article, [data-message-author-role]")) score += 4;
  score -= Math.abs(rect.width - 960) / 180;
  score -= node.childElementCount > 40 ? 4 : 0;
  return score;
}

function findComposerInputs(root = document) {
  return Array.from(root.querySelectorAll?.([
    "textarea",
    "input[type='text']",
    "[contenteditable='true']",
    "[role='textbox']",
  ].join(",")) || []).filter((node) => {
    if (!(node instanceof HTMLElement) || !visible(node)) return false;
    const label = compactText(`${node.getAttribute("aria-label") || ""} ${node.getAttribute("placeholder") || ""}`);
    return label.includes("message") ||
      label.includes("prompt") ||
      label.includes("ask") ||
      node.closest("[data-testid*='composer' i]") ||
      node.closest("[class*='composer' i]") ||
      node.tagName === "TEXTAREA";
  });
}

function mainSidebarRight(root = document) {
  const aside = findMainSidebar(root);
  if (!(aside instanceof HTMLElement) || !visible(aside)) return 0;
  const rect = aside.getBoundingClientRect();
  return Math.max(0, Math.round(rect.right));
}

function findMainSidebar(root = document) {
  const aside = root.querySelector?.(ASIDE_SELECTOR);
  return aside instanceof HTMLElement && visible(aside) ? aside : null;
}

function targetOffsetFor(node, offset, sidebarRight) {
  const parentLeft = Math.round(node.parentElement?.getBoundingClientRect?.().left ?? 0);
  const minOffset = Math.max(0, Math.round(sidebarRight) + Math.round(offset) - parentLeft);
  return Math.max(Math.round(offset), minOffset);
}

function renderHandles(state) {
  state.handleLayer?.remove();
  state.handleLayer = null;
  document.querySelectorAll(`[${ROOT_ATTR}="handles"], [${ROOT_ATTR}="handle"]`).forEach((node) => node.remove());
}

function updateLayout(state, patch, options = {}) {
  state.layout = normalizeLayout({ ...state.layout, ...patch });
  if (options.persist) state.api.storage.set(STORAGE_KEY, state.layout);
  applyLayout(state);
}

function renderSettings(root, state) {
  if (!root) return;
  state.pageRoot = root;
  root.replaceChildren();
  const wrap = document.createElement("div");
  wrap.setAttribute(ROOT_ATTR, "settings");

  const card = document.createElement("div");
  card.setAttribute(ROOT_ATTR, "card");
  card.append(
    toggleRow(state, "enabled", "Enable layout override", "Apply custom chat alignment and width."),
    numberRow(state, "offset", "Left offset", "Distance from the left edge of the content area.", LIMITS.minOffset, LIMITS.maxOffset),
    numberRow(state, "width", "Content width", "Width of chat messages and composer.", LIMITS.minWidth, LIMITS.maxWidth),
  );

  const actions = document.createElement("div");
  actions.setAttribute(ROOT_ATTR, "actions");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.setAttribute(ROOT_ATTR, "button");
  reset.textContent = "Reset";
  reset.addEventListener("click", () => updateLayout(state, DEFAULT_LAYOUT, { persist: true }));
  actions.append(reset);

  wrap.append(card, actions);
  root.append(wrap);
}

function numberRow(state, key, title, description, min, max) {
  const row = baseRow(title, description);
  const range = document.createElement("input");
  range.type = "range";
  range.min = String(min);
  range.max = String(max);
  range.step = "1";
  range.value = String(state.layout[key]);
  range.setAttribute(ROOT_ATTR, "range");

  const number = document.createElement("input");
  number.type = "number";
  number.min = String(min);
  number.max = String(max);
  number.step = "1";
  number.value = String(state.layout[key]);
  number.setAttribute(ROOT_ATTR, "number");

  const sync = (value) => {
    const next = Number(value);
    updateLayout(state, { [key]: next }, { persist: true });
  };
  range.addEventListener("input", () => sync(range.value));
  number.addEventListener("change", () => sync(number.value));
  row.append(range, number);
  return row;
}

function toggleRow(state, key, title, description) {
  const row = baseRow(title, description);
  const spacer = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(state.layout[key]);
  checkbox.addEventListener("change", () => updateLayout(state, { [key]: checkbox.checked }, { persist: true }));
  row.append(spacer, checkbox);
  return row;
}

function baseRow(title, description) {
  const row = document.createElement("div");
  row.setAttribute(ROOT_ATTR, "row");
  const copy = document.createElement("div");
  const label = document.createElement("div");
  label.setAttribute(ROOT_ATTR, "label");
  label.textContent = title;
  const desc = document.createElement("div");
  desc.setAttribute(ROOT_ATTR, "description");
  desc.textContent = description;
  copy.append(label, desc);
  row.append(copy);
  return row;
}

function normalizeLayout(value) {
  const raw = value && typeof value === "object" ? value : {};
  const offset = clamp(Number(raw.offset ?? DEFAULT_LAYOUT.offset), LIMITS.minOffset, LIMITS.maxOffset);
  const width = clamp(Number(raw.width ?? DEFAULT_LAYOUT.width), LIMITS.minWidth, LIMITS.maxWidth);
  return {
    enabled: raw.enabled !== false,
    offset,
    width,
    handles: false,
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function compactText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}

function installStyle() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  document.head.appendChild(style);
  return style;
}

function visible(node) {
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

if (typeof module !== "undefined") {
  module.exports._internals = {
    normalizeLayout,
    clamp,
    compactText,
    looksLikeContentColumn,
    targetOffsetFor,
  };
}
