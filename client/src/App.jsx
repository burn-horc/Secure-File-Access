import { useEffect, useMemo, useRef, useState } from "react";
import { useToast, Box } from "@chakra-ui/react";
import { Switch, Route } from "wouter";
import CheckerPage from "./CheckerPage";
import AdminPage from "./AdminPage";
import { showAppToast } from "./appToast.jsx";
const MAX_JSON_PAYLOAD_BYTES = 850_000;
const MAX_CHECKS_PER_REQUEST_CAP = 120;
const TARGET_REQUEST_RUNTIME_MS = 240_000;
const ESTIMATED_DIRECT_TIMEOUT_MS = 12_000;
const ESTIMATED_PER_CHECK_OVERHEAD_MS = 500;
const DEFAULT_WORKER_COUNT = 1;
const MIN_WORKER_COUNT = 1;
const MAX_WORKER_COUNT = 1;
const MAX_CHECK_LOG_LINES = 1000;
const FILE_PICKER_ACCEPT = ".json,.txt,.csv";
const STORAGE_KEY = "netflix-checker:checked-cookies:v1";

const payloadSizeEncoder = new TextEncoder();
const COOKIE_ATTRIBUTE_NAMES = new Set([
  "path",
  "domain",
  "expires",
  "max-age",
  "secure",
  "httponly",
  "samesite",
  "priority",
  "partitioned",
  "sameparty",
]);

function friendlyReason(reason) {
  if (!reason) return "Unknown error";
  if (/^HTTP 5\d\d$/.test(reason.trim()) || reason.includes("HTTP 5")) {
    return "Netflix is temporarily blocking — try again in a few minutes";
  }
  return reason;
}

function looksLikeCookieHeaderInput(value) {
  const candidates = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const cookieFieldMatch = line.match(/\|\s*cookie\s*=\s*(.+)$/i);
      if (cookieFieldMatch?.[1]) {
        return [cookieFieldMatch[1].trim()];
      }
      return line
        .split("|")
        .map((segment) => segment.trim())
        .filter(Boolean);
    });

  for (const candidate of candidates) {
    const tokens = candidate.split(";");
    for (const token of tokens) {
      const trimmedToken = token.trim();
      if (!trimmedToken) continue;

      const separatorIndex = trimmedToken.indexOf("=");
      if (separatorIndex <= 0) continue;

      const name = trimmedToken.slice(0, separatorIndex).trim();
      const cookieValue = trimmedToken.slice(separatorIndex + 1).trim();
      if (!name || !cookieValue) continue;
      if (COOKIE_ATTRIBUTE_NAMES.has(name.toLowerCase())) continue;
      return true;
    }
  }

  return false;
}

function validateInputFormat(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "Paste Netscape rows, JSON cookie data, or raw/header cookie strings.";
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      return "Invalid JSON cookie format. Paste a valid JSON cookie array/object.";
    }
  }

  if (!trimmed.includes("\t")) {
    if (looksLikeCookieHeaderInput(trimmed)) {
      return null;
    }
    return "Input is invalid. Use Netscape rows, JSON cookie data, or raw/header cookie strings.";
  }

  return null;
}

function clampWorkerCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_WORKER_COUNT;
  }
  const wholeValue = Math.trunc(value);
  return Math.min(MAX_WORKER_COUNT, Math.max(MIN_WORKER_COUNT, wholeValue));
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function isCookieObject(value) {
  return isRecord(value) && "name" in value && "value" in value;
}

function isDirectCookieObjectArray(values) {
  return values.length > 0 && values.every((item) => isCookieObject(item));
}

function countCookieRowsByCookiesKey(value) {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countCookieRowsByCookiesKey(item), 0);
  }

  if (!isRecord(value)) {
    return 0;
  }

  const hasCookiesKey = Object.prototype.hasOwnProperty.call(value, "cookies");
  let total = hasCookiesKey ? 1 : 0;

  for (const nestedValue of Object.values(value)) {
    total += countCookieRowsByCookiesKey(nestedValue);
  }

  return total;
}

function inferPayloadCookieTotal(payloadCookies) {
  if (payloadCookies.length === 0) {
    return 0;
  }

  if (isDirectCookieObjectArray(payloadCookies)) {
    return 1;
  }

  const cookiesKeyCount = payloadCookies.reduce(
    (total, value) => total + countCookieRowsByCookiesKey(value),
    0
  );

  if (cookiesKeyCount > 0) {
    return cookiesKeyCount;
  }

  return payloadCookies.length;
}

function getPayloadSizeBytes(payload) {
  return payloadSizeEncoder.encode(JSON.stringify(payload)).length;
}

function getMaxChecksPerRequest(concurrency) {
  const normalizedConcurrency = Math.max(MIN_WORKER_COUNT, Math.trunc(concurrency));
  const estimatedPerCheckMs = ESTIMATED_DIRECT_TIMEOUT_MS + ESTIMATED_PER_CHECK_OVERHEAD_MS;
  const runtimeBound = Math.floor(
    (TARGET_REQUEST_RUNTIME_MS * normalizedConcurrency) / estimatedPerCheckMs
  );

  return Math.max(1, Math.min(MAX_CHECKS_PER_REQUEST_CAP, runtimeBound));
}

function chunkJsonEntries(entries, concurrency) {
  if (entries.length <= 1) {
    return [entries];
  }

  const maxChecksPerRequest = getMaxChecksPerRequest(concurrency);
  const chunks = [];
  let currentChunk = [];

  for (const entry of entries) {
    const candidateChunk = [...currentChunk, entry];
    const candidatePayload = {
      cookies: candidateChunk,
      stream: true,
      concurrency,
    };

    const exceedsCheckCount = currentChunk.length >= maxChecksPerRequest;
    const exceedsPayloadSize = getPayloadSizeBytes(candidatePayload) > MAX_JSON_PAYLOAD_BYTES;

    if (currentChunk.length > 0 && (exceedsCheckCount || exceedsPayloadSize)) {
      chunks.push(currentChunk);
      currentChunk = [entry];
      continue;
    }

    currentChunk = candidateChunk;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function buildCheckRequestPayloads(input, workerCount) {
  const normalizedWorkerCount = clampWorkerCount(workerCount);
  const maxChecksPerRequest = getMaxChecksPerRequest(normalizedWorkerCount);
  const trimmed = input.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return [{ input, stream: true, concurrency: normalizedWorkerCount }];
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [{ input, stream: true, concurrency: normalizedWorkerCount }];
  }

  const normalizedArray = Array.isArray(parsed) ? parsed : [parsed];
  if (normalizedArray.length === 0) {
    return [{ input, stream: true, concurrency: normalizedWorkerCount }];
  }

  if (isDirectCookieObjectArray(normalizedArray)) {
    return [{ cookies: normalizedArray, stream: true, concurrency: normalizedWorkerCount }];
  }

  const compactPayload = {
    cookies: normalizedArray,
    stream: true,
    concurrency: normalizedWorkerCount,
  };

  const compactSize = getPayloadSizeBytes(compactPayload);
  if (normalizedArray.length <= maxChecksPerRequest && compactSize <= MAX_JSON_PAYLOAD_BYTES) {
    return [compactPayload];
  }

  return chunkJsonEntries(normalizedArray, normalizedWorkerCount).map((chunk) => ({
    cookies: chunk,
    stream: true,
    concurrency: normalizedWorkerCount,
  }));
}

function getKnownTotalFromPayloads(requestPayloads) {
  let total = 0;

  for (const payload of requestPayloads) {
    if (!Array.isArray(payload.cookies)) {
      return null;
    }
    total += inferPayloadCookieTotal(payload.cookies);
  }

  return total;
}

async function readApiErrorMessage(response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (payload.error?.trim()) {
        return payload.error.trim();
      }
    } catch {
      // continue
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) {
      return text.startsWith("<") ? `Request failed with ${response.status}.` : text;
    }
  } catch {
    // continue
  }

  return `Request failed with ${response.status}.`;
}

async function consumeCheckStream(stream, handlers, abortSignal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processEvent = (rawBlock) => {
    const lines = rawBlock.split("\n");
    let eventName = "message";
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      throw new Error("Server returned invalid stream payload.");
    }

    if (eventName === "result") {
      handlers.onResult(payload);
      return;
    }

    if (eventName === "start") {
      handlers.onStart?.(payload);
      return;
    }

    if (eventName === "done") {
      handlers.onDone(payload);
      return;
    }

    if (eventName === "error") {
      const message = payload?.error || "Unable to continue streamed check.";
      throw new Error(message);
    }
  };

  const drainBuffer = () => {
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (block) {
        processEvent(block);
      }
      boundary = buffer.indexOf("\n\n");
    }
  };

  try {
    while (true) {
      if (abortSignal?.aborted) {
        throw new DOMException("Check aborted", "AbortError");
      }

      const chunk = await reader.read();
      if (chunk.done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
      drainBuffer();
    }

    const tail = buffer.replace(/\r\n/g, "\n").trim();
    if (tail) {
      processEvent(tail);
    }
  } finally {
    reader.releaseLock();
  }
}

async function runCheckPayloads(requestPayloads, handlers = {}, abortSignal) {
  const { onPartialResults, onProgress, onResult } = handlers;
  const resultSlots = [];
  const completedIndexes = new Set();
  let progressTotal = getKnownTotalFromPayloads(requestPayloads);
  let globalOffset = 0;

  const emitProgress = () => {
    if (!onProgress) return;
    onProgress({
      completed: completedIndexes.size,
      total: progressTotal,
    });
  };

  emitProgress();

  for (let requestIndex = 0; requestIndex < requestPayloads.length; requestIndex += 1) {
    const requestPayload = requestPayloads[requestIndex];
    const chunkOffset = globalOffset;
    let chunkSize = Array.isArray(requestPayload.cookies) ? requestPayload.cookies.length : 0;

    const response = await fetch("/api/check", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal: abortSignal,
      body: JSON.stringify(requestPayload),
    });

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const isStream = contentType.includes("text/event-stream");

    if (response.ok && isStream && response.body) {
      let streamedChunkMax = 0;

      const syncOrderedResults = () => {
        if (!onPartialResults) return;
        const ordered = resultSlots.filter(Boolean);
        onPartialResults(ordered);
      };

      await consumeCheckStream(
        response.body,
        {
          onStart: (payload) => {
            const startedTotal = Number.isFinite(payload?.total)
              ? Math.max(0, payload.total)
              : null;

            if (startedTotal == null) return;

            chunkSize = Math.max(chunkSize, startedTotal);
            const inferredTotal = chunkOffset + startedTotal;
            if (progressTotal == null || inferredTotal > progressTotal) {
              progressTotal = inferredTotal;
            }
            emitProgress();
          },
          onResult: (payload) => {
            const globalIndex = chunkOffset + payload.index;
            resultSlots[globalIndex] = payload.result;
            onResult?.({ index: globalIndex, result: payload.result });
            completedIndexes.add(globalIndex);

            if (Number.isFinite(payload.total)) {
              const inferredTotal = chunkOffset + Math.max(0, payload.total);
              if (progressTotal == null || inferredTotal > progressTotal) {
                progressTotal = inferredTotal;
              }
            }

            streamedChunkMax = Math.max(streamedChunkMax, payload.index + 1);
            emitProgress();
            syncOrderedResults();
          },
          onDone: (payload) => {
            const doneCount = payload.stats?.total ?? 0;
            if (Number.isFinite(doneCount)) {
              const inferredTotal = chunkOffset + Math.max(0, doneCount);
              if (progressTotal == null || inferredTotal > progressTotal) {
                progressTotal = inferredTotal;
              }
            }

            streamedChunkMax = Math.max(streamedChunkMax, doneCount);
            chunkSize = Math.max(chunkSize, streamedChunkMax);
            emitProgress();
            syncOrderedResults();
          },
        },
        abortSignal
      );

      globalOffset += chunkSize;
      continue;
    }

    if (!response.ok) {
      const message = await readApiErrorMessage(response);
      const prefix = requestPayloads.length > 1 ? `Batch part ${requestIndex + 1} failed. ` : "";
      throw new Error(`${prefix}${message || "Unable to run check right now."}`);
    }

    if (!contentType.includes("application/json")) {
      const text = (await response.text()).trim();
      throw new Error(text || "Unexpected response format from server.");
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to run check right now.");
    }

    const nextResults = payload.results ?? [];
    if (nextResults.length > 0) {
      nextResults.forEach((result, index) => {
        const globalIndex = chunkOffset + index;
        resultSlots[globalIndex] = result;
        onResult?.({ index: globalIndex, result });
        completedIndexes.add(globalIndex);
      });

      chunkSize = Math.max(chunkSize, nextResults.length);
      const inferredTotal = chunkOffset + chunkSize;
      if (progressTotal == null || inferredTotal > progressTotal) {
        progressTotal = inferredTotal;
      }
    }

    globalOffset += chunkSize;
    emitProgress();

    if (onPartialResults) {
      const ordered = resultSlots.filter(Boolean);
      onPartialResults(ordered);
    }
  }

  if (progressTotal == null) {
    progressTotal = completedIndexes.size;
  }
  emitProgress();

  return resultSlots.filter(Boolean);
}

function isAbortError(error) {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function toCompactLogText(value, maxLength = 180) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function parseCookieHeaderForExport(cookieHeader) {
  const uniqueCookies = new Map();
  const cookiePairs = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const pair of cookiePairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = pair.slice(0, separatorIndex).trim();
    if (!name || COOKIE_ATTRIBUTE_NAMES.has(name.toLowerCase())) continue;

    const value = pair.slice(separatorIndex + 1).trim();
    uniqueCookies.set(name, {
      name,
      value,
      path: "/",
      domain: ".netflix.com",
      secure: true,
      session: true,
      storeId: "0",
      hostOnly: false,
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return Array.from(uniqueCookies.values());
}

function toExportCookiesFromHeader(cookieHeader) {
  return parseCookieHeaderForExport(cookieHeader);
}

function extractCookieHeadersFromLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const cookieFieldMatch = trimmed.match(/\|\s*Cookie\s*=\s*(.+)$/i);
  if (cookieFieldMatch?.[1]) {
    return [cookieFieldMatch[1].trim()];
  }

  return trimmed
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function convertHeaderLinesToBatchJson(inputText) {
  const lines = inputText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const rows = [];

  for (const line of lines) {
    const headers = extractCookieHeadersFromLine(line);
    for (const header of headers) {
      if (!header || !header.includes("=")) continue;

      const cookies = toExportCookiesFromHeader(header);
      if (cookies.length === 0) continue;

      rows.push({ cookies });
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return JSON.stringify(rows, null, 2);
}

function normalizeUploadedInputText(rawText) {
  const text = rawText.replace(/^\uFEFF/, "");
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return text;
  if (trimmed.includes("\t")) return text;

  const converted = convertHeaderLinesToBatchJson(text);
  return converted ?? null;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kibibytes = bytes / 1024;
    return `${kibibytes >= 100 ? kibibytes.toFixed(0) : kibibytes.toFixed(1)} KB`;
  }
  const mebibytes = bytes / (1024 * 1024);
  return `${mebibytes.toFixed(2)} MB`;
}

function readStoredCookieChecks() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredCookieChecks(entries) {
  const normalized = entries.slice(0, 2500);
  if (typeof window === "undefined" || !window.localStorage) return normalized;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }

  return normalized;
}

function upsertStoredCookieChecksFromResults(results) {
  const existing = readStoredCookieChecks();
  const byHeader = new Map();

  for (const entry of existing) {
    if (entry?.cookieHeader) {
      byHeader.set(entry.cookieHeader, entry);
    }
  }

  for (const result of results) {
    const cookieHeader = typeof result?.cookieHeader === "string" ? result.cookieHeader.trim() : "";
    if (!cookieHeader) continue;

    byHeader.set(cookieHeader, {
      ...result,
      cookieHeader,
      checkedAt: new Date().toISOString(),
    });
  }

  return writeStoredCookieChecks(Array.from(byHeader.values()));
}

export default function App() {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [uploadedInputSource, setUploadedInputSource] = useState(null);
  const [checkLogs, setCheckLogs] = useState([]);
  const [checkProgress, setCheckProgress] = useState({ completed: 0, total: null });
  const [isLoading, setIsLoading] = useState(false);
  const [bulkValidResults, setBulkValidResults] = useState([]);
  const [workerCount, setWorkerCount] = useState(DEFAULT_WORKER_COUNT);
  const [checkNFToken, setCheckNFToken] = useState(true);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [passcodeLoading, setPasscodeLoading] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('netflix-checker:sound') !== 'off');
  const [liveValidCount, setLiveValidCount] = useState(0);
  const [liveInvalidCount, setLiveInvalidCount] = useState(0);
  const [liveResultIds, setLiveResultIds] = useState(new Set());
  const [vpnBlocked, setVpnBlocked] = useState(false);

  const toggleSound = () => setSoundEnabled(prev => {
    const next = !prev;
    localStorage.setItem('netflix-checker:sound', next ? 'on' : 'off');
    return next;
  });

  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523.25, 0], [659.25, 0.18], [783.99, 0.36]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + delay + 0.06);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.45);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.5);
      });
    } catch {}
  };

  const uploadInputRef = useRef(null);
  const checkLogRef = useRef(null);
  const activeCheckAbortControllerRef = useRef(null);
  const latestPartialResultsRef = useRef([]);
  const nextCheckLogIdRef = useRef(1);
  const findAccountRetryRef = useRef(0);

  const uploadedInputBanner = uploadedInputSource
    ? `Using file: ${uploadedInputSource.fileName} (${formatFileSize(uploadedInputSource.fileSize)})`
    : null;

  const progressPercent = useMemo(() => {
    if (!isLoading) {
      return checkProgress.total && checkProgress.total > 0 ? 100 : 0;
    }

    if (checkProgress.total && checkProgress.total > 0) {
      const ratio = (checkProgress.completed / checkProgress.total) * 100;
      return Math.max(0, Math.min(100, ratio));
    }

    return 0;
  }, [checkProgress.completed, checkProgress.total, isLoading]);

  const isProgressIndeterminate = isLoading && (!checkProgress.total || checkProgress.total <= 0);
  const progressBarStyle = isProgressIndeterminate ? undefined : { width: `${progressPercent}%` };

  const appendCheckLog = (tone, text) => {
    const nextEntry = {
      id: nextCheckLogIdRef.current,
      tone,
      text,
    };

    nextCheckLogIdRef.current += 1;

    setCheckLogs((current) => {
      const next = [...current, nextEntry];
      if (next.length > MAX_CHECK_LOG_LINES) {
        return next.slice(next.length - MAX_CHECK_LOG_LINES);
      }
      return next;
    });
  };

  const showToast = (message) => {
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    if (!normalizedMessage) return;

    const normalizedIdSuffix = normalizedMessage
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    showAppToast(toast, {
      id: `app-error-${normalizedIdSuffix || "message"}`,
      title: normalizedMessage,
      status: "error",
      duration: 3600,
    });
  };

  useEffect(() => {
    return () => {
      activeCheckAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    fetch('/api/vpn-status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data.blocked) setVpnBlocked(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const logNode = checkLogRef.current;
    if (!logNode) return;
    logNode.scrollTop = logNode.scrollHeight;
  }, [checkLogs, isLoading]);

  const runCheckCore = async (activeInput, skipFormatValidation = false) => {
    if (!activeInput.trim() || isLoading) return;

    if (!skipFormatValidation) {
      const formatError = validateInputFormat(activeInput);
      if (formatError) {
        showToast(formatError);
        return;
      }
    }

    const abortController = new AbortController();
    activeCheckAbortControllerRef.current = abortController;
    nextCheckLogIdRef.current = 1;
    setCheckLogs([]);

    setIsLoading(true);
    toast.closeAll();
    setBulkValidResults([]); // reset bulk modal
    latestPartialResultsRef.current = [];
    setCheckProgress({ completed: 0, total: null });
    setLiveValidCount(0);
    setLiveInvalidCount(0);
    setLiveResultIds(new Set());

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      if (abortController.signal.aborted) {
        throw new DOMException("Check aborted", "AbortError");
      }

      const normalizedWorkerCount = clampWorkerCount(workerCount);
      if (normalizedWorkerCount !== workerCount) {
        setWorkerCount(normalizedWorkerCount);
      }

      const requestPayloads = buildCheckRequestPayloads(activeInput, normalizedWorkerCount).map(
        (payload) => ({
          ...payload,
          skipNFToken: !checkNFToken,
        })
      );
      const knownTotal = getKnownTotalFromPayloads(requestPayloads);
      appendCheckLog(
        "info",
        knownTotal && knownTotal > 0
          ? `Starting check for ${knownTotal} cookie(s)...`
          : "Starting check..."
      );
      if (!checkNFToken) {
        appendCheckLog("info", "NFTOKEN generation skipped. Returning cookies + account details only.");
      }

      setCheckProgress({ completed: 0, total: knownTotal });

      const orderedResults = await runCheckPayloads(
        requestPayloads,
        {
          onPartialResults: (partialResults) => {
            latestPartialResultsRef.current = partialResults;
          },
          onProgress: (progress) => {
            setCheckProgress(progress);
          },
          onResult: (streamEvent) => {
            const planLabel = streamEvent.result.plan?.trim() || "Unknown Plan";
            const countryLabel = streamEvent.result.countryOfSignup?.trim() || "Unknown Country";

            if (streamEvent.result.valid) {
              setLiveValidCount(prev => prev + 1);
              const ck = streamEvent.result.cookieHeader || String(Date.now());
              setLiveResultIds(prev => new Set([...prev, ck]));
              setTimeout(() => setLiveResultIds(prev => { const next = new Set(prev); next.delete(ck); return next; }), 30000);
              if (soundEnabled) playSuccessChime();
              setBulkValidResults((prev) => [...prev, streamEvent.result]);
              const tokenWasSkipped =
                streamEvent.result.nftokenStage === "skipped" ||
                streamEvent.result.nftokenError === "Skipped by user option" ||
                !checkNFToken;
              const hasToken = Boolean(
                streamEvent.result.hasTokenLink ||
                  (typeof streamEvent.result.nftokenLink === "string" &&
                    streamEvent.result.nftokenLink.trim())
              );
              const tokenStage = toCompactLogText(streamEvent.result.nftokenStage, 36);
              const tokenError = toCompactLogText(streamEvent.result.nftokenError, 150);
              const tokenStatus = tokenWasSkipped
                ? "NFTOKEN SKIPPED"
                : hasToken
                  ? "NFTOKEN READY"
                  : `NFTOKEN MISSING${
                      tokenStage || tokenError
                        ? ` (${[tokenStage ? `stage=${tokenStage}` : "", tokenError]
                            .filter(Boolean)
                            .join(" | ")})`
                        : ""
                    }`;
              appendCheckLog("valid", `VALID - ${planLabel} - ${countryLabel} - ${tokenStatus}`);
              return;
            }

            setLiveInvalidCount(prev => prev + 1);
            const reason = friendlyReason(streamEvent.result.reason?.trim() || "Unknown error");
            appendCheckLog("invalid", `INVALID - ${planLabel} - ${countryLabel} - ${reason}`);
          },
        },
        abortController.signal
      );

      setCheckProgress({
        completed: orderedResults.length,
        total: knownTotal ?? orderedResults.length,
      });

      // Always show latest valid result in modal (even in bulk)


      upsertStoredCookieChecksFromResults(orderedResults);

      appendCheckLog(
        "info",
        `Completed: ${orderedResults.filter((item) => item.valid).length} valid, ${
          orderedResults.filter((item) => !item.valid).length
        } invalid.`
      );
    } catch (caughtError) {
      if (isAbortError(caughtError)) {
        const partialResults = latestPartialResultsRef.current;
        toast.closeAll();
        setCheckProgress({
          completed: partialResults.length,
          total: partialResults.length,
        });

        upsertStoredCookieChecksFromResults(partialResults);

        appendCheckLog("info", "Stopped. Showing partial results.");
        return;
      }

      const message = caughtError instanceof Error ? caughtError.message : "Unexpected client error";
      appendCheckLog("invalid", `Error: ${message}`);
      showToast(message);
    } finally {
      activeCheckAbortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const runCheck = async (event) => {
    event.preventDefault();
    const activeInput = uploadedInputSource?.normalizedText ?? input;
    await runCheckCore(activeInput, Boolean(uploadedInputSource));
  };

  const stopCheck = () => {
    if (!isLoading) return;
    activeCheckAbortControllerRef.current?.abort();
  };

  const openUploadPicker = () => {
    uploadInputRef.current?.click();
  };

  const runFindAccountScan = async (passcodeArg = verifiedPasscode) => {
  if (isLoading) return;

  const abortController = new AbortController();
  activeCheckAbortControllerRef.current = abortController;
  nextCheckLogIdRef.current = 1;
  setCheckLogs([]);
  setIsLoading(true);
  toast.closeAll();
  setBulkValidResults([]);
  latestPartialResultsRef.current = [];
  setCheckProgress({ completed: 0, total: null });
  setLiveValidCount(0);
  setLiveInvalidCount(0);
  setLiveResultIds(new Set());

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    if (abortController.signal.aborted) throw new DOMException("Check aborted", "AbortError");

    if (!passcodeArg) {
      throw new Error("Passcode is required.");
    }

    appendCheckLog("info", "Loading cookies from storage...");

    const response = await fetch("/api/find-account", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        stream: true,
        passcode: passcodeArg,
      }),
    });

    if (response.status === 401) {
      setSessionUnlocked(false);
      setVerifiedPasscode("");
      setIsPasscodeModalOpen(true);
      setIsLoading(false);
      activeCheckAbortControllerRef.current = null;
      return;
    }

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const msg = data.error || "You have reached the 3 daily limit for Generate Account. Try again tomorrow.";
      setIsLoading(false);
      activeCheckAbortControllerRef.current = null;
      appendCheckLog("error", msg);
      toast({ status: "error", title: msg, isClosable: true });
      return;
    }

    if (!response.ok) {
      const msg = await readApiErrorMessage(response);
      throw new Error(msg);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/event-stream") || !response.body) {
      throw new Error("Server did not return a stream.");
    }

    let completed = 0;
    let total = null;

    await consumeCheckStream(
      response.body,
      {
        onStart: (payload) => {
          total = Number.isFinite(payload?.total) ? payload.total : null;
          appendCheckLog("info", total ? `Starting check for ${total} cookie(s)...` : "Starting check...");
          setCheckProgress({ completed: 0, total });
        },
        onResult: (payload) => {
          const result = payload.result;
          completed++;
          latestPartialResultsRef.current = [...latestPartialResultsRef.current, result];
          setCheckProgress({ completed, total });

          const planLabel = result.plan?.trim() || "Unknown Plan";
          const countryLabel = result.countryOfSignup?.trim() || "Unknown Country";

          if (result.valid) {
            setLiveValidCount((prev) => prev + 1);
            const ck = result.cookieHeader || String(Date.now());
            setLiveResultIds((prev) => new Set([...prev, ck]));
            setTimeout(
              () =>
                setLiveResultIds((prev) => {
                  const next = new Set(prev);
                  next.delete(ck);
                  return next;
                }),
              30000
            );
            setBulkValidResults((prev) => [...prev, result]);
            appendCheckLog("valid", `VALID - ${planLabel} - ${countryLabel}`);
            if (soundEnabled) playSuccessChime();
            abortController.abort();
          } else {
            setLiveInvalidCount((prev) => prev + 1);
            const reason = friendlyReason(result.reason?.trim() || "Unknown error");
            appendCheckLog("invalid", `INVALID - ${planLabel} - ${countryLabel} - ${reason}`);
          }
        },
        onDone: (payload) => {
          const doneTotal = payload.stats?.total ?? completed;
          setCheckProgress({ completed: doneTotal, total: doneTotal });
        },
      },
      abortController.signal
    );

    upsertStoredCookieChecksFromResults(latestPartialResultsRef.current);
    const validCount = latestPartialResultsRef.current.filter((r) => r.valid).length;
    const invalidCount = latestPartialResultsRef.current.filter((r) => !r.valid).length;

    const allHttp500 =
      invalidCount > 0 &&
      validCount === 0 &&
      latestPartialResultsRef.current.every((r) => !r.valid && String(r.reason ?? "").includes("500"));

    if (allHttp500 && findAccountRetryRef.current < 3) {
      findAccountRetryRef.current += 1;
      appendCheckLog(
        "info",
        `All results returned HTTP 500. Retrying in 3 seconds... (attempt ${findAccountRetryRef.current}/3)`
      );
      window.setTimeout(() => runFindAccountScan(passcodeArg), 3000);
      return;
    }

    if (allHttp500 && findAccountRetryRef.current >= 3) {
      appendCheckLog("info", "All retries exhausted. The cookies may be expired or blocked by Netflix.");
    } else {
      appendCheckLog("info", `Completed: ${validCount} valid, ${invalidCount} invalid.`);
    }
  } catch (caughtError) {
    if (isAbortError(caughtError)) {
      upsertStoredCookieChecksFromResults(latestPartialResultsRef.current);
      const foundValid = latestPartialResultsRef.current.filter((r) => r.valid).length;
      if (foundValid > 0) {
        appendCheckLog("info", "Found 1 live account.");
      } else {
        appendCheckLog("info", "Stopped. No live account found yet.");
      }
      return;
    }
    const message = caughtError instanceof Error ? caughtError.message : "Unexpected client error";
    appendCheckLog("invalid", `Error: ${message}`);
    showToast(message);
  } finally {
    activeCheckAbortControllerRef.current = null;
    setIsLoading(false);
  }
};

  const runFindAccount = () => {
  if (isLoading) return;
  findAccountRetryRef.current = 0;

  if (sessionUnlocked) {
    if (!verifiedPasscode) {
      setSessionUnlocked(false);
      setPasscodeError("");
      setIsPasscodeModalOpen(true);
      return;
    }
    runFindAccountScan(verifiedPasscode);
  } else {
    setPasscodeInput("");
    setPasscodeError("");
    setIsPasscodeModalOpen(true);
  }
};

const handlePasscodeSubmit = async () => {
  const code = passcodeInput.trim();
  if (!code) return;

  setPasscodeLoading(true);
  setPasscodeError("");

  try {
    const res = await fetch("/api/find-account/verify-passcode", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: code }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      setVerifiedPasscode(code);
      setSessionUnlocked(true);
      setIsPasscodeModalOpen(false);
      setPasscodeInput("");
      findAccountRetryRef.current = 0;
      runFindAccountScan(code);
    } else {
      setPasscodeError(data.error || "Incorrect passcode.");
    }
  } catch {
    setPasscodeError("Network error. Try again.");
  } finally {
    setPasscodeLoading(false);
  }
};
  const handleCookieInputChange = (event) => {
    const nextValue = event.target.value;

    if (uploadedInputSource) {
      const trimmedValue =
        uploadedInputBanner && nextValue.startsWith(uploadedInputBanner)
          ? nextValue.slice(uploadedInputBanner.length).trimStart()
          : nextValue;

      setUploadedInputSource(null);
      setInput(trimmedValue);
      return;
    }

    setInput(nextValue);
  };

  const decrementWorkerCount = () => {
    setWorkerCount((current) => clampWorkerCount(current - 1));
  };

  const incrementWorkerCount = () => {
    setWorkerCount((current) => clampWorkerCount(current + 1));
  };

  const handleCheckNFTokenChange = (event) => {
    setCheckNFToken(Boolean(event.target.checked));
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const fileText = await file.text();
      const normalized = normalizeUploadedInputText(fileText);
      if (!normalized) {
        showToast(
          "Uploaded file is empty or unsupported. Use JSON, Netscape, or raw/header cookie lines."
        );
        return;
      }

      setUploadedInputSource({
        fileName: file.name,
        fileSize: file.size,
        normalizedText: normalized,
      });
      setInput("");
      toast.closeAll();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Unable to read uploaded file.";
      showToast(message);
    }
  };

  

  if (vpnBlocked) {
    return (
      <Box minH="100vh" bg="#141414" display="flex" alignItems="center" justifyContent="center" p={6}>
        <Box textAlign="center" maxW="420px">
          <Box color="#e50914" fontSize="64px" fontWeight="900" letterSpacing="-2px" mb={6} lineHeight={1}>N</Box>
          <Box color="#e50914" fontSize="22px" fontWeight="700" mb={3}>Access Blocked</Box>
          <Box color="#aaa" fontSize="15px" lineHeight="1.7">
            A VPN or proxy connection has been detected.<br />
            Please disable your VPN and refresh the page.
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Switch>
      <Route path="/admin">
        <AdminPage />
      </Route>
      <Route>
        <Box position="relative">
          <CheckerPage
            input={input}
            uploadedInputBanner={uploadedInputBanner}
            isLoading={isLoading}
            checkLogs={checkLogs}
            checkLogRef={checkLogRef}
            workerCount={workerCount}
            checkProgress={checkProgress}
            progressBarStyle={progressBarStyle}
            isProgressIndeterminate={isProgressIndeterminate}
            uploadInputRef={uploadInputRef}
            filePickerAccept={FILE_PICKER_ACCEPT}
            minWorkerCount={MIN_WORKER_COUNT}
            maxWorkerCount={sessionUnlocked ? MAX_WORKER_COUNT : 1}
            runCheck={runCheck}
            stopCheck={stopCheck}
            handleCookieInputChange={handleCookieInputChange}
            decrementWorkerCount={decrementWorkerCount}
            incrementWorkerCount={incrementWorkerCount}
            checkNFToken={checkNFToken}
            toggleCheckNFToken={handleCheckNFTokenChange}
            openUploadPicker={openUploadPicker}
            handleUploadFile={handleUploadFile}
            runFindAccount={runFindAccount}
            bulkValidResults={bulkValidResults}
            isPasscodeModalOpen={isPasscodeModalOpen}
            setIsPasscodeModalOpen={setIsPasscodeModalOpen}
            passcodeInput={passcodeInput}
            setPasscodeInput={setPasscodeInput}
            passcodeError={passcodeError}
            passcodeLoading={passcodeLoading}
            handlePasscodeSubmit={handlePasscodeSubmit}
            sessionUnlocked={sessionUnlocked}
            soundEnabled={soundEnabled}
            toggleSound={toggleSound}
            liveValidCount={liveValidCount}
            liveInvalidCount={liveInvalidCount}
            liveResultIds={liveResultIds}
          />
        </Box>
      </Route>
    </Switch>
  );
}








