const assert = require("node:assert/strict");
const test = require("node:test");

global.window = {
  innerWidth: 1800,
  getComputedStyle() {
    return { display: "block", visibility: "visible" };
  },
};

global.HTMLElement = class HTMLElement {};

global.document = {
  body: {},
  documentElement: {},
  head: {
    appendChild() {},
  },
  getElementById() {
    return null;
  },
  createElement() {
    return {
      id: "",
      textContent: "",
      style: {},
      remove() {},
    };
  },
};

const { _internals } = require("../index.js");

test("normalizeLayout fills defaults", () => {
  assert.deepEqual(_internals.normalizeLayout({}), {
    enabled: true,
    offset: 24,
    width: 960,
    handles: false,
  });
});

test("normalizeLayout clamps numeric values", () => {
  assert.deepEqual(_internals.normalizeLayout({
    enabled: false,
    offset: -50,
    width: 9000,
    handles: false,
  }), {
    enabled: false,
    offset: 0,
    width: 1600,
    handles: false,
  });
});

test("compactText normalizes labels", () => {
  assert.equal(_internals.compactText(" Ask for follow-up changes "), "askforfollow-upchanges");
});

test("looksLikeContentColumn accepts centered max-width containers", () => {
  const node = {
    className: "mx-auto max-w-3xl",
    getAttribute() {
      return "";
    },
    querySelector() {
      return null;
    },
  };
  const rect = { width: 960, height: 400, left: 320, right: 1280 };

  assert.equal(_internals.looksLikeContentColumn(node, rect, 1800), true);
});

test("looksLikeContentColumn rejects full-width shells", () => {
  const node = {
    className: "flex h-full",
    getAttribute() {
      return "";
    },
    querySelector() {
      return null;
    },
  };
  const rect = { width: 1700, height: 900, left: 72, right: 1772 };

  assert.equal(_internals.looksLikeContentColumn(node, rect, 1800), false);
});
