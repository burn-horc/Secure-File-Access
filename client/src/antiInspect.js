const GLOBAL_FLAG = "__dawgAntiInspectInitialized__";
const DEVTOOLS_SIZE_THRESHOLD_PX = 160;
const DEVTOOLS_POLL_INTERVAL_MS = 500;
const DEBUGGER_TRAP_INTERVAL_MS = 250;
const UI_LOCK_ATTR = "data-anti-inspect-locked";

function isCoarsePointerDevice() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

function isEditableElement(target) {
  if (!target || typeof target.closest !== "function") {
    return false;
  }

  const editableNode = target.closest(
    "textarea, [contenteditable=''], [contenteditable='true'], [data-allow-context-menu], input"
  );
  if (!editableNode) {
    return false;
  }

  if (editableNode.matches("textarea")) {
    return true;
  }

  if (editableNode.matches("[contenteditable=''], [contenteditable='true']")) {
    return true;
  }

  if (editableNode.matches("[data-allow-context-menu]")) {
    return true;
  }

  if (!editableNode.matches("input")) {
    return false;
  }

  const blockedInputTypes = new Set([
    "button",
    "submit",
    "reset",
    "checkbox",
    "radio",
    "range",
    "file",
    "image",
    "color",
    "hidden",
  ]);
  const type = String(editableNode.getAttribute("type") || "text").toLowerCase();
  return !blockedInputTypes.has(type);
}

function shouldBlockKeydown(event) {
  const key = String(event?.key ?? "").toLowerCase();
  const keyCode = Number(event?.keyCode ?? 0);
  const ctrlOrMeta = Boolean(event?.ctrlKey || event?.metaKey);
  const shift = Boolean(event?.shiftKey);
  const alt = Boolean(event?.altKey);

  if (key === "f12" || keyCode === 123) {
    return true;
  }

  if (ctrlOrMeta && shift && ["i", "j", "c", "k"].includes(key)) {
    return true;
  }

  if (ctrlOrMeta && key === "u") {
    return true;
  }

  if (event?.metaKey && alt && ["i", "j", "c", "u"].includes(key)) {
    return true;
  }

  return false;
}

function isDevtoolsLikelyOpen() {
  if (typeof window === "undefined") return false;

  const widthDelta = Math.max(0, window.outerWidth - window.innerWidth);
  const heightDelta = Math.max(0, window.outerHeight - window.innerHeight);
  return widthDelta > DEVTOOLS_SIZE_THRESHOLD_PX || heightDelta > DEVTOOLS_SIZE_THRESHOLD_PX;
}

function isLikelyProductionHost() {
  if (typeof window === "undefined") return false;
  const hostname = String(window.location?.hostname || "").toLowerCase();
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
  if (hostname.endsWith(".local")) return false;
  return true;
}

export function initAntiInspectGuard({ productionOnly = true } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  if (productionOnly && !isLikelyProductionHost()) {
    return () => {};
  }

  if (window[GLOBAL_FLAG]) {
    return () => {};
  }
  window[GLOBAL_FLAG] = true;

  const handleContextMenu = (event) => {
    if (isCoarsePointerDevice() || isEditableElement(event?.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const handleKeydown = (event) => {
    if (!shouldBlockKeydown(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  let debuggerTrapTimer = null;
  let devtoolsPollTimer = null;
  let uiLocked = false;
  let previousPointerEvents = "";
  let previousUserSelect = "";
  let previousCursor = "";

  const lockUi = () => {
    if (uiLocked || !document?.body) return;
    previousPointerEvents = document.body.style.pointerEvents || "";
    previousUserSelect = document.body.style.userSelect || "";
    previousCursor = document.body.style.cursor || "";
    document.body.style.pointerEvents = "none";
    document.body.style.userSelect = "none";
    document.body.style.cursor = "wait";
    document.body.setAttribute(UI_LOCK_ATTR, "true");
    uiLocked = true;
  };

  const unlockUi = () => {
    if (!uiLocked || !document?.body) return;
    document.body.style.pointerEvents = previousPointerEvents;
    document.body.style.userSelect = previousUserSelect;
    document.body.style.cursor = previousCursor;
    document.body.removeAttribute(UI_LOCK_ATTR);
    uiLocked = false;
  };

  const stopDebuggerTrap = () => {
    if (debuggerTrapTimer) {
      window.clearInterval(debuggerTrapTimer);
      debuggerTrapTimer = null;
    }
  };

  const startDebuggerTrap = () => {
    if (debuggerTrapTimer) return;
    debuggerTrapTimer = window.setInterval(() => {
      debugger;
    }, DEBUGGER_TRAP_INTERVAL_MS);
  };

  const syncDevtoolsState = () => {
    const open = isDevtoolsLikelyOpen();
    if (open) {
      lockUi();
      startDebuggerTrap();
      return;
    }

    stopDebuggerTrap();
    unlockUi();
  };

  document.addEventListener("contextmenu", handleContextMenu, true);
  window.addEventListener("keydown", handleKeydown, true);
  syncDevtoolsState();
  devtoolsPollTimer = window.setInterval(syncDevtoolsState, DEVTOOLS_POLL_INTERVAL_MS);

  return () => {
    stopDebuggerTrap();
    if (devtoolsPollTimer) {
      window.clearInterval(devtoolsPollTimer);
      devtoolsPollTimer = null;
    }
    unlockUi();
    document.removeEventListener("contextmenu", handleContextMenu, true);
    window.removeEventListener("keydown", handleKeydown, true);
    window[GLOBAL_FLAG] = false;
  };
}
