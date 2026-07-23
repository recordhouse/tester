(() => {
  "use strict";

  const STORAGE_KEY = "user-flow-tester:events:v1";
  const SESSIONS_KEY = "user-flow-tester:sessions:v1";
  const META_KEY = "user-flow-tester:meta:v1";
  const CONTROL_ATTR = "data-recorder-ignore";
  const CONTROL_CLASS = "flow-recorder";
  const STYLE_ID = "flow-recorder-style";
  const CONTROL_WINDOW_NAME = "FlowRecorderSessions";
  const CONTROL_WINDOW_FEATURES = "popup=yes,width=190,height=240,left=80,top=80,resizable=yes,scrollbars=yes";
  const AUTO_START_RECORDING = true;
  const MAX_SESSIONS = 20;
  const SCROLL_SAMPLE_MS = 32;
  const CLICK_PULSE_MS = 520;
  const SCROLL_INDICATOR_MS = 760;
  const USER_SCROLL_SIGNAL_MS = 900;
  const PERSIST_DEBOUNCE_MS = 120;
  const QUIET_MS = 140;
  const TARGET_WAIT_MS = 7000;
  const SCROLL_KEYS = new Set([
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "End",
    "Home",
    "PageDown",
    "PageUp",
    " ",
    "Spacebar",
  ]);
  const CONTROL_CSS = `
    .flow-recorder {
      position: fixed;
      top: 50px;
      right: auto;
      bottom: auto;
      left: 50%;
      z-index: 2147483000;
      display: inline-flex;
      gap: 4px;
      align-items: center;
      transform: translateX(-50%);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .flow-recorder button {
      min-width: 38px;
      min-height: 24px;
      height: 24px;
      border: 0;
      border-radius: 5px;
      background: #b42345;
      color: #ffffff;
      padding: 0 7px;
      box-shadow: 0 8px 18px rgba(28, 36, 48, 0.18);
      cursor: pointer;
      font-size: 11px;
      font-weight: 800;
      line-height: 24px;
    }

    .flow-recorder button[data-action="record"] {
      background: #b42345;
    }

    .flow-recorder button[data-action="replay"] {
      background: #0f766e;
    }

    .flow-recorder button:hover,
    .flow-recorder button:focus-visible {
      background: #982039;
      outline: none;
    }

    .flow-recorder button[data-action="replay"]:hover,
    .flow-recorder button[data-action="replay"]:focus-visible {
      background: #0d5f59;
    }

    .flow-recorder button[data-action="record"][data-state="recording"] {
      background: #b42345;
    }

    .flow-recorder button[data-action="replay"][data-state="replaying"] {
      background: #0d5f59;
    }

    .flow-recorder button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .flow-click-pulse {
      position: fixed;
      z-index: 2147482999;
      width: 18px;
      height: 18px;
      border: 2px solid #b42345;
      border-radius: 999px;
      pointer-events: none;
      transform: translate(-50%, -50%) scale(0.7);
      animation: flow-click-pulse 520ms ease-out forwards;
    }

    .flow-click-pulse::after {
      position: absolute;
      inset: 4px;
      border-radius: inherit;
      background: rgba(180, 35, 69, 0.22);
      content: "";
    }

    .flow-scroll-indicator {
      position: fixed;
      top: 80px;
      right: auto;
      bottom: auto;
      left: 10px;
      z-index: 2147482999;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      border-radius: 6px;
      background: rgba(28, 36, 48, 0.94);
      color: #ffffff;
      padding: 5px 9px;
      box-shadow: 0 8px 18px rgba(28, 36, 48, 0.18);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 800;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition:
        opacity 160ms ease,
        transform 160ms ease;
    }

    .flow-scroll-indicator.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .flow-scroll-icon {
      position: relative;
      width: 13px;
      height: 19px;
      border: 2px solid currentColor;
      border-radius: 999px;
    }

    .flow-scroll-icon::before {
      position: absolute;
      top: 4px;
      left: 50%;
      width: 3px;
      height: 5px;
      border-radius: 999px;
      background: currentColor;
      content: "";
      transform: translateX(-50%);
      animation: flow-scroll-wheel 760ms ease-in-out infinite;
    }

    @keyframes flow-click-pulse {
      0% {
        opacity: 0.95;
        transform: translate(-50%, -50%) scale(0.7);
      }

      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(2.6);
      }
    }

    @keyframes flow-scroll-wheel {
      0% {
        opacity: 0;
        transform: translate(-50%, 0);
      }

      35% {
        opacity: 1;
      }

      100% {
        opacity: 0;
        transform: translate(-50%, 7px);
      }
    }
  `;
  const POPUP_CONTROL_CSS = `
    ${CONTROL_CSS}

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: auto;
      background: #111827;
      color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .flow-session-list {
      display: grid;
      gap: 6px;
      padding: 8px;
    }

    .flow-session-button {
      width: 100%;
      height: 24px;
      min-height: 24px;
      border: 0;
      border-radius: 5px;
      background: #1f2937;
      color: #ffffff;
      padding: 0 6px;
      box-shadow: none;
      font-size: 11px;
      font-weight: 800;
      line-height: 24px;
      white-space: nowrap;
      cursor: pointer;
    }

    .flow-session-button:hover,
    .flow-session-button:focus-visible {
      background: #0f766e;
      outline: none;
    }
  `;

  const state = {
    events: [],
    sessions: readJson(SESSIONS_KEY, []),
    currentSessionId: "",
    isRecording: false,
    isReplaying: false,
    startAt: 0,
    pendingRequests: 0,
    lastMutationAt: performance.now(),
    scrollLastAt: new Map(),
    scrollTimers: new Map(),
    replayAbort: false,
    lastUserScrollInputAt: 0,
    persistTimer: 0,
    controlWindow: null,
    recordButton: null,
    replayButton: null,
    sessionList: null,
    scrollIndicator: null,
    scrollIndicatorTimer: 0,
    meta: readJson(META_KEY, {}),
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("[FlowTester] localStorage 저장에 실패했습니다.", error);
    }
  }

  function persist() {
    syncCurrentSessionEvents();
    writeJson(STORAGE_KEY, state.events);
    writeJson(SESSIONS_KEY, state.sessions);
    writeJson(META_KEY, {
      ...state.meta,
      isRecording: state.isRecording,
      updatedAt: Date.now(),
      version: 1,
    });
  }

  function schedulePersist() {
    if (state.persistTimer) return;

    state.persistTimer = window.setTimeout(() => {
      state.persistTimer = 0;
      persist();
    }, PERSIST_DEBOUNCE_MS);
  }

  function flushPersist() {
    window.clearTimeout(state.persistTimer);
    state.persistTimer = 0;
    persist();
  }

  function formatSessionLabel(date = new Date()) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function getCurrentSession() {
    return state.sessions.find((session) => session.id === state.currentSessionId) || null;
  }

  function syncCurrentSessionEvents() {
    const session = getCurrentSession();
    if (!session) return;

    session.events = [...state.events];
    session.updatedAt = Date.now();
  }

  function createRecordingSession() {
    const now = Date.now();
    const session = {
      id: `recording-${now}`,
      label: formatSessionLabel(new Date(now)),
      startedAt: now,
      updatedAt: now,
      events: [],
    };

    state.currentSessionId = session.id;
    state.sessions = [session, ...state.sessions].slice(0, MAX_SESSIONS);
    if (!state.controlWindow || state.controlWindow.closed) openControlWindow();
    renderSessionButtons();
    persist();

    return session;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\#.;:[\],>+~*^$|=()\s]/g, "\\$&");
  }

  function cssStringEscape(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function isIgnoredTarget(target) {
    return Boolean(target.closest && target.closest(`[${CONTROL_ATTR}]`));
  }

  function isFormValueElement(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.isContentEditable
    );
  }

  function getElementValue(element) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        return { checked: element.checked, value: element.value };
      }

      return { value: element.value };
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return { value: element.value };
    }

    if (element.isContentEditable) {
      return { text: element.textContent || "" };
    }

    return {};
  }

  function setNativeProperty(element, property, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);

    if (descriptor?.set) {
      descriptor.set.call(element, value);
      return;
    }

    element[property] = value;
  }

  function setElementValue(element, detail) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        setNativeProperty(element, "checked", Boolean(detail.checked));
      } else {
        setNativeProperty(element, "value", detail.value ?? "");
      }
      return;
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      setNativeProperty(element, "value", detail.value ?? "");
      return;
    }

    if (element.isContentEditable) {
      element.textContent = detail.text ?? "";
    }
  }

  function getStableSelector(element) {
    if (!element || element === document) return "";
    if (element === window) return "__window__";
    if (element === document.documentElement) return "html";
    if (element === document.body) return "body";

    if (element.id) {
      const selector = `#${cssEscape(element.id)}`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }

    for (const attr of ["data-testid", "data-test", "data-cy", "name"]) {
      const value = element.getAttribute(attr);
      if (!value) continue;

      const selector = `${element.tagName.toLowerCase()}[${attr}="${cssStringEscape(value)}"]`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement?.children || []).filter(
        (node) => node.tagName === current.tagName,
      );
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
      current = current.parentElement;
    }

    return parts.length ? `body > ${parts.join(" > ")}` : "body";
  }

  function getElementLabelText(element) {
    const id = element.id ? cssStringEscape(element.id) : "";
    const explicitLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
    const wrappingLabel = element.closest ? element.closest("label") : null;
    const label = explicitLabel || wrappingLabel;

    return label?.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) || "";
  }

  function getElementHint(element) {
    return {
      tag: element.tagName?.toLowerCase() || "",
      id: element.id || "",
      name: element.getAttribute("name") || "",
      type: element.getAttribute("type") || "",
      role: element.getAttribute("role") || "",
      placeholder: element.getAttribute("placeholder") || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      autocomplete: element.getAttribute("autocomplete") || "",
      labelText: getElementLabelText(element),
      contentEditable: element.isContentEditable,
    };
  }

  function findTarget(selector) {
    if (!selector || selector === "__window__") return window;

    try {
      return document.querySelector(selector);
    } catch (_error) {
      return null;
    }
  }

  function normalizeScrollTarget(target) {
    if (
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      target === window
    ) {
      return window;
    }

    return target;
  }

  function getScrollSnapshot(target) {
    const normalized = normalizeScrollTarget(target);

    if (normalized === window) {
      return {
        selector: "__window__",
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
    }

    return {
      selector: getStableSelector(normalized),
      scrollLeft: normalized.scrollLeft,
      scrollTop: normalized.scrollTop,
    };
  }

  function nowMs() {
    return Math.max(0, Math.round(performance.now() - state.startAt));
  }

  function showClickPulseAt(clientX, clientY) {
    const pulse = document.createElement("span");
    pulse.className = "flow-click-pulse";
    pulse.setAttribute(CONTROL_ATTR, "true");
    pulse.style.left = `${Math.round(clientX)}px`;
    pulse.style.top = `${Math.round(clientY)}px`;

    document.body.append(pulse);

    window.setTimeout(() => {
      pulse.remove();
    }, CLICK_PULSE_MS);
  }

  function showClickPulse(event) {
    showClickPulseAt(event.clientX, event.clientY);
  }

  function createScrollIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "flow-scroll-indicator";
    indicator.setAttribute(CONTROL_ATTR, "true");
    indicator.setAttribute("aria-live", "polite");

    const icon = document.createElement("span");
    icon.className = "flow-scroll-icon";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = "스크롤중";

    indicator.append(icon, text);
    document.body.append(indicator);
    state.scrollIndicator = indicator;

    return indicator;
  }

  function showScrollIndicator() {
    const indicator = state.scrollIndicator || createScrollIndicator();
    indicator.classList.add("is-visible");

    window.clearTimeout(state.scrollIndicatorTimer);
    state.scrollIndicatorTimer = window.setTimeout(() => {
      indicator.classList.remove("is-visible");
    }, SCROLL_INDICATOR_MS);
  }

  function ensureControlStyles() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.textContent = CONTROL_CSS;
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute(CONTROL_ATTR, "true");
    style.textContent = CONTROL_CSS;
    (document.head || document.body).append(style);
  }

  function markUserScrollIntent(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target && isIgnoredTarget(target)) return;
    state.lastUserScrollInputAt = performance.now();
  }

  function handleScrollKeydown(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;

    if (!SCROLL_KEYS.has(event.key)) return;
    if (target && (isIgnoredTarget(target) || isFormValueElement(target))) return;
    state.lastUserScrollInputAt = performance.now();
  }

  function isRecentUserScroll() {
    return performance.now() - state.lastUserScrollInputAt <= USER_SCROLL_SIGNAL_MS;
  }

  function pushEvent(event, { deferPersist = false } = {}) {
    if (!state.isRecording || state.isReplaying) return;

    state.events.push({
      at: nowMs(),
      url: location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      ...event,
    });

    if (deferPersist) {
      schedulePersist();
      return;
    }

    flushPersist();
  }

  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || isIgnoredTarget(target)) return;

    if (!state.isReplaying) showClickPulse(event);

    pushEvent({
      type: "click",
      selector: getStableSelector(target),
      pointer: {
        clientX: Math.round(event.clientX),
        clientY: Math.round(event.clientY),
      },
      button: event.button,
    });
  }

  function handleInput(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || isIgnoredTarget(target) || !isFormValueElement(target)) return;

    pushEvent({
      type: event.type,
      selector: getStableSelector(target),
      element: getElementHint(target),
      detail: getElementValue(target),
    });
  }

  function flushScrollSnapshot(target) {
    const snapshot = getScrollSnapshot(target);

    pushEvent({
      type: "scroll",
      ...snapshot,
    }, { deferPersist: true });
  }

  function handleScroll(event) {
    if (state.isReplaying || !isRecentUserScroll()) return;

    showScrollIndicator();

    const target = normalizeScrollTarget(event.target);
    const snapshot = getScrollSnapshot(target);
    const key = snapshot.selector;
    const current = performance.now();
    const last = state.scrollLastAt.get(key) || 0;

    if (current - last >= SCROLL_SAMPLE_MS) {
      state.scrollLastAt.set(key, current);
      flushScrollSnapshot(target);
    }

    clearTimeout(state.scrollTimers.get(key));
    state.scrollTimers.set(
      key,
      window.setTimeout(() => {
        state.scrollLastAt.set(key, performance.now());
        flushScrollSnapshot(target);
      }, SCROLL_SAMPLE_MS),
    );
  }

  function patchNetworkTracking() {
    if (window.__flowTesterNetworkPatched) return;
    window.__flowTesterNetworkPatched = true;

    const originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
      window.fetch = (...args) => {
        state.pendingRequests += 1;
        return originalFetch.apply(window, args).finally(() => {
          state.pendingRequests = Math.max(0, state.pendingRequests - 1);
          state.lastMutationAt = performance.now();
        });
      };
    }

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patchedSend(...args) {
      state.pendingRequests += 1;
      this.addEventListener(
        "loadend",
        () => {
          state.pendingRequests = Math.max(0, state.pendingRequests - 1);
          state.lastMutationAt = performance.now();
        },
        { once: true },
      );
      try {
        return originalSend.apply(this, args);
      } catch (error) {
        state.pendingRequests = Math.max(0, state.pendingRequests - 1);
        throw error;
      }
    };
  }

  function watchDomQuietTime() {
    const observer = new MutationObserver(() => {
      state.lastMutationAt = performance.now();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
  }

  async function nextFrame() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function waitForIdle(maxWaitMs = 12000) {
    const start = performance.now();

    while (performance.now() - start < maxWaitMs) {
      const quietFor = performance.now() - state.lastMutationAt;
      const documentReady = document.readyState !== "loading";

      if (documentReady && state.pendingRequests === 0 && quietFor >= QUIET_MS) {
        await nextFrame();
        return;
      }

      await sleep(40);
    }
  }

  function isVisibleElement(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function scoreInputCandidate(candidate, hint = {}) {
    if (!candidate || !hint) return 0;

    const tag = candidate.tagName?.toLowerCase() || "";
    let score = 0;

    if (hint.tag) {
      if (tag !== hint.tag) return -1;
      score += 1;
    }

    if (hint.type && candidate.getAttribute("type") !== hint.type) return -1;

    const checks = [
      ["id", candidate.id, 8],
      ["name", candidate.getAttribute("name"), 7],
      ["placeholder", candidate.getAttribute("placeholder"), 5],
      ["ariaLabel", candidate.getAttribute("aria-label"), 5],
      ["role", candidate.getAttribute("role"), 3],
      ["title", candidate.getAttribute("title"), 3],
      ["autocomplete", candidate.getAttribute("autocomplete"), 2],
      ["labelText", getElementLabelText(candidate), 4],
    ];

    for (const [key, value, weight] of checks) {
      if (hint[key] && value === hint[key]) score += weight;
    }

    return score;
  }

  function getActiveInputTarget() {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return null;
    if (!isFormValueElement(active) || isIgnoredTarget(active) || !isVisibleElement(active)) return null;

    return active;
  }

  function findInputFallbackTarget(event) {
    if (event?.type !== "input" && event?.type !== "change") return null;

    const active = getActiveInputTarget();
    if (active && scoreInputCandidate(active, event.element || {}) >= 0) return active;

    const hint = event.element || {};
    const candidates = Array.from(
      document.querySelectorAll(
        'input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]',
      ),
    ).filter((candidate) => (
      isFormValueElement(candidate) &&
      !isIgnoredTarget(candidate) &&
      isVisibleElement(candidate)
    ));

    let best = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      const score = scoreInputCandidate(candidate, hint);
      if (score >= bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function getReplayTarget(selector, event) {
    const target = findTarget(selector);

    if (event?.type !== "input" && event?.type !== "change") return target;

    const fallback = findInputFallbackTarget(event);
    if (!target || !isFormValueElement(target)) return fallback || target;

    if (!fallback || fallback === target) return target;

    const targetScore = scoreInputCandidate(target, event.element || {});
    const fallbackScore = scoreInputCandidate(fallback, event.element || {});

    return fallbackScore > targetScore + 1 ? fallback : target;
  }

  async function waitForTarget(selector, timeoutMs = TARGET_WAIT_MS, event = null) {
    const start = performance.now();

    while (performance.now() - start < timeoutMs) {
      const target = getReplayTarget(selector, event);
      if (target) return target;
      await sleep(50);
    }

    return null;
  }

  function dispatchMouseSequence(target, event) {
    if (!target || target === window) return;

    const point = event.pointer || {};
    const options = {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: event.button || 0,
      clientX: point.clientX || 0,
      clientY: point.clientY || 0,
    };

    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      target.dispatchEvent(new MouseEvent(type, options));
    }

    if (typeof target.click === "function") {
      target.click();
    } else {
      target.dispatchEvent(new MouseEvent("click", options));
    }
  }

  function dispatchValueEvents(target, event) {
    if (typeof target.focus === "function") {
      try {
        target.focus({ preventScroll: true });
      } catch (_error) {
        target.focus();
      }
    }

    setElementValue(target, event.detail || {});

    target.dispatchEvent(
      new Event(event.type, {
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  function playScroll(event) {
    const target = findTarget(event.selector);

    if (target === window || event.selector === "__window__") {
      window.scrollTo(event.scrollX || 0, event.scrollY || 0);
      return;
    }

    if (!target) return;
    target.scrollLeft = event.scrollLeft || 0;
    target.scrollTop = event.scrollTop || 0;
  }

  async function playEvent(event) {
    if (event.type === "scroll") {
      playScroll(event);
      return;
    }

    const target = await waitForTarget(event.selector, TARGET_WAIT_MS, event);
    if (!target) {
      console.warn("[FlowTester] 재생할 대상을 찾지 못했습니다.", event);
      return;
    }

    if (target !== window && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", inline: "nearest" });
      await nextFrame();
    }

    if (event.type === "click") {
      const rect = target.getBoundingClientRect();
      const pointer = event.pointer || {};
      const clientX = pointer.clientX || rect.left + rect.width / 2;
      const clientY = pointer.clientY || rect.top + rect.height / 2;
      showClickPulseAt(clientX, clientY);
      dispatchMouseSequence(target, event);
      return;
    }

    if (event.type === "input" || event.type === "change") {
      dispatchValueEvents(target, event);
    }
  }

  function syncControlState() {
    if (state.controlWindow?.closed) {
      state.controlWindow = null;
      state.sessionList = null;
    }

    if (!state.recordButton || !state.replayButton) return;

    state.recordButton.textContent = state.isRecording ? "녹음중" : "녹음";
    state.recordButton.dataset.state = state.isRecording ? "recording" : "idle";
    state.recordButton.disabled = state.isReplaying;
    state.recordButton.setAttribute("aria-pressed", state.isRecording ? "true" : "false");

    state.replayButton.textContent = state.isReplaying ? "중지" : "재생";
    state.replayButton.dataset.state = state.isReplaying ? "replaying" : "idle";
    state.replayButton.disabled = state.isRecording || (!state.isReplaying && !state.events.length);
    state.replayButton.setAttribute("aria-pressed", state.isReplaying ? "true" : "false");
  }

  function createControlElements(ownerDocument) {
    const wrap = ownerDocument.createElement("div");
    wrap.className = CONTROL_CLASS;
    wrap.setAttribute(CONTROL_ATTR, "true");

    const recordButton = ownerDocument.createElement("button");
    recordButton.type = "button";
    recordButton.textContent = "녹음";
    recordButton.dataset.action = "record";
    recordButton.dataset.state = "idle";
    recordButton.setAttribute("aria-pressed", "false");

    const replayButton = ownerDocument.createElement("button");
    replayButton.type = "button";
    replayButton.textContent = "재생";
    replayButton.dataset.action = "replay";
    replayButton.dataset.state = "idle";
    replayButton.setAttribute("aria-pressed", "false");

    recordButton.addEventListener("click", () => {
      if (state.isReplaying) return;

      if (state.isRecording) {
        stopRecording();
        return;
      }

      startRecording({ append: false });
    });

    replayButton.addEventListener("click", () => {
      if (state.isRecording) return;

      if (state.isReplaying) {
        stopReplay();
        return;
      }

      if (!state.events.length) return;
      replay();
    });

    wrap.append(recordButton, replayButton);

    return { wrap, recordButton, replayButton };
  }

  function renderSessionButtons() {
    if (state.controlWindow?.closed) {
      state.controlWindow = null;
      state.sessionList = null;
      return;
    }

    if (!state.sessionList) return;

    const ownerDocument = state.sessionList.ownerDocument;
    state.sessionList.textContent = "";

    for (const session of state.sessions) {
      const button = ownerDocument.createElement("button");
      button.type = "button";
      button.className = "flow-session-button";
      button.textContent = session.label;
      button.title = new Date(session.startedAt).toLocaleString("ko-KR");
      button.addEventListener("click", () => replaySession(session.id));
      state.sessionList.append(button);
    }
  }

  function openControlWindow() {
    try {
      const popup = window.open("", CONTROL_WINDOW_NAME, CONTROL_WINDOW_FEATURES);
      if (!popup || popup.closed) return null;

      popup.document.open();
      popup.document.write(`<!doctype html>
        <html lang="ko">
          <head>
            <meta charset="utf-8" />
            <title>Flow Controls</title>
            <style>${POPUP_CONTROL_CSS}</style>
          </head>
          <body>
            <div id="flow-session-list" class="flow-session-list"></div>
          </body>
        </html>`);
      popup.document.close();
      popup.addEventListener("beforeunload", () => {
        if (state.controlWindow === popup) {
          state.controlWindow = null;
          state.sessionList = null;
        }
      });
      state.controlWindow = popup;
      state.sessionList = popup.document.getElementById("flow-session-list");
      renderSessionButtons();

      return popup;
    } catch (error) {
      console.warn("[FlowTester] 녹화 시간 팝업을 열 수 없습니다.", error);
      return null;
    }
  }

  function createControl() {
    const { wrap, recordButton, replayButton } = createControlElements(document);

    document.body.append(wrap);
    state.recordButton = recordButton;
    state.replayButton = replayButton;
    syncControlState();
  }

  function startRecording({ append }) {
    state.replayAbort = true;
    state.isReplaying = false;
    state.isRecording = true;
    state.events = append ? state.events : [];
    if (!append || !getCurrentSession()) {
      createRecordingSession();
    }
    const lastEvent = state.events.length ? state.events[state.events.length - 1] : null;
    const lastAt = lastEvent?.at || 0;
    state.startAt = performance.now() - lastAt;
    state.meta = {
      isRecording: true,
      startedAt: append ? state.meta.startedAt || Date.now() : Date.now(),
      startUrl: location.href,
      version: 1,
    };
    syncControlState();
    flushPersist();
  }

  function stopRecording() {
    state.isRecording = false;
    state.meta = {
      ...state.meta,
      isRecording: false,
      stoppedAt: Date.now(),
    };
    syncControlState();
    flushPersist();
  }

  function stopReplay() {
    state.replayAbort = true;
    state.isReplaying = false;
    syncControlState();
  }

  function replaySession(sessionId) {
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session || !session.events?.length) return;

    if (state.isRecording) stopRecording();
    if (state.isReplaying) stopReplay();

    state.currentSessionId = session.id;
    state.events = [...session.events];
    syncControlState();
    replay();
  }

  async function replay({ resumeRecording = false } = {}) {
    if (!state.events.length || state.isReplaying) return;

    state.replayAbort = false;
    state.isRecording = false;
    state.isReplaying = true;
    syncControlState();

    await waitForIdle();
    const replayStart = performance.now();
    const sortedEvents = [...state.events].sort((a, b) => a.at - b.at);

    for (const event of sortedEvents) {
      if (state.replayAbort) break;

      const scheduledAt = replayStart + event.at;
      const waitMs = scheduledAt - performance.now();
      if (waitMs > 0) await sleep(waitMs);
      if (state.replayAbort) break;

      if (event.type !== "scroll") {
        await waitForIdle();
        if (state.replayAbort) break;
      }

      await playEvent(event);
      if (state.replayAbort) break;

      if (event.type !== "scroll") {
        await waitForIdle();
      }
    }

    state.isReplaying = false;

    if (state.isRecording) return;

    if (resumeRecording && !state.replayAbort) {
      startRecording({ append: true });
      return;
    }

    syncControlState();
  }

  function attachListeners() {
    document.addEventListener("wheel", markUserScrollIntent, { capture: true, passive: true });
    document.addEventListener("touchmove", markUserScrollIntent, { capture: true, passive: true });
    document.addEventListener("keydown", handleScrollKeydown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    document.addEventListener("scroll", handleScroll, true);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPersist();
    });
    window.addEventListener("beforeunload", flushPersist);
    window.addEventListener("pagehide", flushPersist);
  }

  function boot() {
    state.events = readJson(STORAGE_KEY, []);
    state.sessions = readJson(SESSIONS_KEY, state.sessions);
    if (!Array.isArray(state.sessions)) state.sessions = [];

    patchNetworkTracking();
    watchDomQuietTime();
    ensureControlStyles();
    createControl();
    openControlWindow();
    attachListeners();

    if (state.meta.isRecording) {
      state.meta = {
        ...state.meta,
        isRecording: false,
        stoppedAt: state.meta.updatedAt || Date.now(),
      };
      flushPersist();
    }

    if (AUTO_START_RECORDING) {
      startRecording({ append: false });
      return;
    }

    syncControlState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.UserFlowTester = Object.freeze({
    start: () => startRecording({ append: false }),
    stop: stopRecording,
    stopReplay,
    replay: () => replay(),
    clear: () => {
      window.clearTimeout(state.persistTimer);
      state.persistTimer = 0;
      state.events = [];
      state.sessions = [];
      state.currentSessionId = "";
      state.meta = {};
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSIONS_KEY);
      localStorage.removeItem(META_KEY);
      renderSessionButtons();
      syncControlState();
    },
    getEvents: () => [...state.events],
  });
})();
