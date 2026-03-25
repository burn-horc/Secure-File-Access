import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Input,
  keyframes,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Switch,
  Text,
  Textarea,
  usePrefersReducedMotion,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { SiNetflix, SiFacebook, SiTelegram } from "react-icons/si";
import AppCredits from "./AppCredits";
import { showAppToast } from "./appToast.jsx";

function displayValue(value, fallback = "N/A") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function displayBoolean(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "N/A";
}

function readResultTokenLink(result) {
  const link = typeof result?.nftokenLink === "string" ? result.nftokenLink.trim() : "";
  return link || "";
}

function extractNFToken(link) {
  try {
    const url = new URL(link);
    return url.searchParams.get("nftoken");
  } catch {
    return null;
  }
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(dateStr) {
  const days = getDaysUntil(dateStr);
  if (days === null) return null;
  if (days <= 0) return { label: "Expired", color: "#ff4d4d", bg: "rgba(255,77,77,0.15)" };
  if (days <= 2) return { label: `${days}d left`, color: "#ff4d4d", bg: "rgba(255,77,77,0.15)" };
  if (days <= 7) return { label: `${days}d left`, color: "#f6c90e", bg: "rgba(246,201,14,0.13)" };
  return { label: `${days}d left`, color: "#00d563", bg: "rgba(0,213,99,0.12)" };
}

function getCountryFlag(country) {
  if (!country) return "🌐";
  const c = country.toLowerCase();
  if (c.includes("philippine") || c.includes("pilipinas")) return "🇵🇭";
  if (c.includes("united states") || c === "us" || c === "usa") return "🇺🇸";
  if (c.includes("united kingdom") || c === "uk" || c === "gb") return "🇬🇧";
  if (c.includes("canada")) return "🇨🇦";
  if (c.includes("australia")) return "🇦🇺";
  if (c.includes("germany") || c.includes("deutsch")) return "🇩🇪";
  if (c.includes("france")) return "🇫🇷";
  if (c.includes("brazil") || c.includes("brasil")) return "🇧🇷";
  if (c.includes("mexico") || c.includes("méxico")) return "🇲🇽";
  if (c.includes("japan") || c.includes("nippon")) return "🇯🇵";
  if (c.includes("korea")) return "🇰🇷";
  if (c.includes("india")) return "🇮🇳";
  if (c.includes("singapore")) return "🇸🇬";
  if (c.includes("malaysia")) return "🇲🇾";
  if (c.includes("indonesia")) return "🇮🇩";
  if (c.includes("thailand")) return "🇹🇭";
  if (c.includes("netherlands") || c.includes("holland")) return "🇳🇱";
  if (c.includes("spain") || c.includes("españa")) return "🇪🇸";
  if (c.includes("italy") || c.includes("italia")) return "🇮🇹";
  if (c.includes("turkey") || c.includes("türkiye")) return "🇹🇷";
  if (c.includes("argentina")) return "🇦🇷";
  if (c.includes("colombia")) return "🇨🇴";
  if (c.includes("chile")) return "🇨🇱";
  if (c.includes("portugal")) return "🇵🇹";
  if (c.includes("poland")) return "🇵🇱";
  if (c.includes("sweden")) return "🇸🇪";
  if (c.includes("norway")) return "🇳🇴";
  if (c.includes("denmark")) return "🇩🇰";
  if (c.includes("taiwan")) return "🇹🇼";
  if (c.includes("hong kong")) return "🇭🇰";
  if (c.includes("new zealand")) return "🇳🇿";
  if (c.includes("south africa")) return "🇿🇦";
  if (c.includes("saudi")) return "🇸🇦";
  if (c.includes("uae") || c.includes("emirates")) return "🇦🇪";
  return "🌐";
}

function getAccountGrade(result) {
  let score = 0;
  const plan = (result?.plan || '').toLowerCase();
  if (plan.includes('premium') || plan.includes('ultra')) score += 3;
  else if (plan.includes('standard')) score += 2;
  else if (plan.includes('basic') || plan.includes('ads')) score += 1;
  else score += 2;
  const days = getDaysUntil(result?.nextBilling);
  if (days !== null) {
    if (days > 20) score += 2;
    else if (days > 7) score += 1;
    else if (days <= 0) score -= 2;
    else score -= 1;
  }
  if (result?.memberSince) {
    const since = new Date(result.memberSince);
    if (!isNaN(since.getTime())) {
      const ageYears = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (ageYears > 2) score += 1;
    }
  }
  if (score >= 6) return { grade: 'S', color: '#ffe066', bg: 'rgba(255,224,102,0.12)' };
  if (score >= 5) return { grade: 'A', color: '#00d563', bg: 'rgba(0,213,99,0.12)' };
  if (score >= 3) return { grade: 'B', color: '#1a56db', bg: 'rgba(26,86,219,0.15)' };
  if (score >= 1) return { grade: 'C', color: '#f6c90e', bg: 'rgba(246,201,14,0.12)' };
  return { grade: 'D', color: '#ff4d4d', bg: 'rgba(255,77,77,0.12)' };
}

async function copyTextToClipboard(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  }

  return false;
}

export default function CheckerPage({
  mode = "premium",
  input,
  uploadedInputBanner,
  isLoading,
  checkLogs,
  checkLogRef,
  workerCount,
  checkProgress,
  progressBarStyle,
  isProgressIndeterminate,
  uploadInputRef,
  filePickerAccept,
  minWorkerCount,
  maxWorkerCount,
  runCheck,
  stopCheck,
  handleCookieInputChange,
  decrementWorkerCount,
  incrementWorkerCount,
  openUploadPicker,
  handleUploadFile,
  runFindAccount,
  checkNFToken,
  toggleCheckNFToken,
  bulkValidResults,
  isPasscodeModalOpen,
  setIsPasscodeModalOpen,
  passcodeInput,
  setPasscodeInput,
  passcodeError,
  passcodeLoading,
  handlePasscodeSubmit,
  sessionUnlocked,
  soundEnabled,
  toggleSound,
  liveValidCount,
  liveInvalidCount,
  liveResultIds,
  runTrial,

  trialResults,
  showTrialResults,
  setShowTrialResults,
  isTrialModalOpen,
  setIsTrialModalOpen,
  trialCodeInput,
  setTrialCodeInput,
  trialCodeError,
  trialLoading,
  handleTrialSubmit,
}) {
  const [, setLocation] = useLocation();
  const isFreePage = mode === "free";
const isPremiumPage = mode === "premium";
  const isTrialPage = mode === "trial";
  const HISTORY_KEY = 'netflix-checker:history:v1';
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [bulkRecheckState, setBulkRecheckState] = useState({ loading: false, done: 0, total: 0 });
  const [accountHistory, setAccountHistory] = useState(() => {
  try {
    if (typeof window === "undefined") return [];
    return JSON.parse(window.localStorage.getItem("netflix-checker:history:v1") || "[]");
  } catch {
    return [];
  }
});
  const [recheckStates, setRecheckStates] = useState({});
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (bulkValidResults && bulkValidResults.length > 0) {
      setIsBulkModalOpen(true);
      setIsMinimized(false);
    }
  }, [bulkValidResults]);

  useEffect(() => {
    if (!sessionUnlocked || !bulkValidResults?.length) return;
    setAccountHistory(prev => {
      const existing = new Set(prev.map(h => h.cookieHeader));
      const newItems = bulkValidResults
        .filter(r => r.cookieHeader && !existing.has(r.cookieHeader))
        .map(r => ({ ...r, savedAt: new Date().toISOString() }));
      if (!newItems.length) return prev;
      const updated = [...newItems, ...prev].slice(0, 100);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [bulkValidResults, sessionUnlocked]);

  const handleRecheck = async (index, cookieHeader) => {
    setRecheckStates(prev => ({ ...prev, [index]: { loading: true, result: null, error: null } }));
    try {
      const resp = await fetch('/api/check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: cookieHeader, stream: false }),
      });
      const data = await resp.json();
      const r = data?.results?.[0];
      setRecheckStates(prev => ({ ...prev, [index]: { loading: false, result: r || null, error: null } }));
      setTimeout(() => setRecheckStates(prev => ({ ...prev, [index]: { loading: false, result: null, error: null } })), 4000);
    } catch {
      setRecheckStates(prev => ({ ...prev, [index]: { loading: false, result: null, error: 'Failed' } }));
      setTimeout(() => setRecheckStates(prev => ({ ...prev, [index]: { loading: false, result: null, error: null } })), 3000);
    }
  };

  const handleDownloadCookies = () => {
    const lines = bulkValidResults.map(r => r.cookieHeader).filter(Boolean).join('\n');
    if (!lines) return;
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netflix-valid-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!bulkValidResults?.length) return;
    const headers = ['Email', 'Plan', 'Country', 'Next Billing', 'Member Since', 'Payment', 'Phone', 'Cookie'];
    const rows = bulkValidResults.map(r =>
      [r.email, r.plan, r.countryOfSignup, r.nextBilling, r.memberSince, r.paymentMethod, r.phone, r.cookieHeader]
        .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
    );
    const csv = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netflix-valid-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRecheckAll = async () => {
    if (bulkRecheckState.loading) return;
    const toCheck = (bulkValidResults || []).filter(r => r.cookieHeader);
    if (!toCheck.length) return;
    setBulkRecheckState({ loading: true, done: 0, total: toCheck.length });
    const updates = {};
    await Promise.allSettled(toCheck.map(async (result, index) => {
      try {
        const resp = await fetch('/api/check', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: result.cookieHeader, stream: false }),
        });
        const data = await resp.json();
        const r = data?.results?.[0];
        updates[index] = { loading: false, result: r || null, error: null };
      } catch {
        updates[index] = { loading: false, result: null, error: 'Failed' };
      }
      setBulkRecheckState(prev => ({ ...prev, done: prev.done + 1 }));
    }));
    setRecheckStates(prev => ({ ...prev, ...updates }));
    setBulkRecheckState({ loading: false, done: toCheck.length, total: toCheck.length });
    setTimeout(() => setBulkRecheckState({ loading: false, done: 0, total: 0 }), 5000);
  };

  const detectedCookieCount = useMemo(() => {
    if (!input?.trim()) return 0;
    const lines = input.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const cookieLines = lines.filter(l => l.includes('=') && l.includes(';'));
    const jsonLines = lines.filter(l => l.startsWith('{') || l.startsWith('['));
    return cookieLines.length + jsonLines.length || lines.length;
  }, [input]);

  const toast = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();
  const showUploadedFileMarker = Boolean(uploadedInputBanner);

  const premiumColorCycle = keyframes`
    0%   { color: #e50914; }
    25%  { color: #ff4d4d; }
    50%  { color: #ff2a2a; }
    75%  { color: #c0000d; }
    100% { color: #e50914; }
  `;
  const premiumAnimation = prefersReducedMotion
    ? undefined
    : `${premiumColorCycle} 1.8s ease-in-out infinite`;
  const bobKeyframes = keyframes`
    0%   { transform: translateY(0px); }
    50%  { transform: translateY(-7px); }
    100% { transform: translateY(0px); }
  `;
  const bobAnimation = prefersReducedMotion
    ? undefined
    : `${bobKeyframes} 2.8s ease-in-out infinite`;
  const arrowBounceKeyframes = keyframes`
    0%   { transform: translateY(0px); opacity: 0.7; }
    50%  { transform: translateY(6px); opacity: 1; }
    100% { transform: translateY(0px); opacity: 0.7; }
  `;
  const arrowBounceAnimation = prefersReducedMotion
    ? undefined
    : `${arrowBounceKeyframes} 1s ease-in-out infinite`;
  const shimmerKeyframes = keyframes`
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  `;
  const shimmerAnimation = prefersReducedMotion
    ? undefined
    : `${shimmerKeyframes} 2.2s linear infinite`;

  const crownFloatKeyframes = keyframes`
    0%   { transform: translateY(0px) rotate(-2deg) scale(1); }
    25%  { transform: translateY(-4px) rotate(0deg) scale(1.06); }
    50%  { transform: translateY(-6px) rotate(2deg) scale(1.08); }
    75%  { transform: translateY(-3px) rotate(0deg) scale(1.04); }
    100% { transform: translateY(0px) rotate(-2deg) scale(1); }
  `;
  const crownFloatAnimation = prefersReducedMotion
    ? undefined
    : `${crownFloatKeyframes} 2s ease-in-out infinite`;

  const cardGlowGreenKf = keyframes`
    0%   { box-shadow: 0 0 12px rgba(0,213,99,0.18), 0 4px 24px rgba(0,0,0,0.6); }
    50%  { box-shadow: 0 0 32px rgba(0,213,99,0.42), 0 4px 24px rgba(0,0,0,0.6); }
    100% { box-shadow: 0 0 12px rgba(0,213,99,0.18), 0 4px 24px rgba(0,0,0,0.6); }
  `;
  const cardGlowGoldKf = keyframes`
    0%   { box-shadow: 0 0 12px rgba(212,160,23,0.22), 0 4px 24px rgba(0,0,0,0.6); }
    50%  { box-shadow: 0 0 32px rgba(212,160,23,0.48), 0 4px 24px rgba(0,0,0,0.6); }
    100% { box-shadow: 0 0 12px rgba(212,160,23,0.22), 0 4px 24px rgba(0,0,0,0.6); }
  `;
  const cardGlowSilverKf = keyframes`
    0%   { box-shadow: 0 0 12px rgba(113,128,150,0.22), 0 4px 24px rgba(0,0,0,0.6); }
    50%  { box-shadow: 0 0 32px rgba(113,128,150,0.45), 0 4px 24px rgba(0,0,0,0.6); }
    100% { box-shadow: 0 0 12px rgba(113,128,150,0.22), 0 4px 24px rgba(0,0,0,0.6); }
  `;
  const cardGlowPurpleKf = keyframes`
    0%   { box-shadow: 0 0 12px rgba(124,58,237,0.25), 0 4px 24px rgba(0,0,0,0.6); }
    50%  { box-shadow: 0 0 32px rgba(124,58,237,0.52), 0 4px 24px rgba(0,0,0,0.6); }
    100% { box-shadow: 0 0 12px rgba(124,58,237,0.25), 0 4px 24px rgba(0,0,0,0.6); }
  `;

  const pulseRedKf = keyframes`
    0%   { transform: scale(1); opacity: 1; }
    50%  { transform: scale(1.35); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  `;
  const pulseRedAnim = prefersReducedMotion ? undefined : `${pulseRedKf} 0.9s ease-in-out infinite`;

  const getPlanTheme = (plan) => {
    const p = (plan || "").toLowerCase();
    if (p.includes("ultimate")) return {
      accent: "#e040fb", border: "#7c3aed",
      bg: "linear-gradient(160deg, #110d1a 0%, #0d0a14 100%)",
      glowAnim: prefersReducedMotion ? undefined : `${cardGlowPurpleKf} 2.5s ease-in-out infinite`,
      badgeColor: "#a855f7", badgeText: "ULTIMATE",
    };
    if (p.includes("premium")) return {
      accent: "#ffe066", border: "#d4a017",
      bg: "linear-gradient(160deg, #141209 0%, #0f0e08 100%)",
      glowAnim: prefersReducedMotion ? undefined : `${cardGlowGoldKf} 2.5s ease-in-out infinite`,
      badgeColor: "#d4a017", badgeText: "PREMIUM",
    };
    if (p.includes("standard")) return {
      accent: "#a0aec0", border: "#718096",
      bg: "linear-gradient(160deg, #0f1218 0%, #0a0d12 100%)",
      glowAnim: prefersReducedMotion ? undefined : `${cardGlowSilverKf} 2.5s ease-in-out infinite`,
      badgeColor: "#718096", badgeText: "STANDARD",
    };
    return {
      accent: "#00d563", border: "#00d563",
      bg: "linear-gradient(160deg, #111a14 0%, #0d1410 100%)",
      glowAnim: prefersReducedMotion ? undefined : `${cardGlowGreenKf} 2.5s ease-in-out infinite`,
      badgeColor: "#00d563", badgeText: "VALID",
    };
  };

  const [showGuide, setShowGuide] = useState(false);
  const [copiedStates, setCopiedStates] = useState({});
  const [copyAllDone, setCopyAllDone] = useState(false);
  const handleCopyWithFeedback = (key, copyFn) => {
    copyFn();
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 1800);
  };

  const getLogToneColor = (tone) =>
    tone === "valid" ? "#23d7c6" : tone === "invalid" ? "#ff6584" : "rgba(255,255,255,0.82)";
  const easing = [0.22, 1, 0.36, 1];
  const fadeInUp = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.34, delay, ease: easing },
        };
  const hoverLift = prefersReducedMotion ? {} : { transform: "translateY(-1px)" };
  const handleAndroidCopy = async (link) => {
    const copied = await copyTextToClipboard(link);
    if (!copied) return;

    const toastId = "checker-single-android-link-copied";
    showAppToast(toast, {
      id: toastId,
      title: "Android link copied",
      status: "success",
      duration: 1600,
    });
  };
  const handlePcCopy = async (link) => {
  const copied = await copyTextToClipboard(link);
  if (!copied) return;

  const toastId = "checker-single-pc-link-copied";
  showAppToast(toast, {
    id: toastId,
    title: "PC link copied",
    status: "success",
    duration: 1600,
  });
};

  const handleTvOpen = (link) => {
  if (!link) return;

  console.log("TV LINK:", link);
  window.open(link, "_blank");

  showAppToast(toast, {
    id: "checker-tv-open",
    title: "TV page opened",
    status: "info",
    duration: 1800,
  });
};
  
  const handleCopyDetails = async (result) => {
    const na = "N/A";
    const lines = [
      "✓ VALID ACCOUNT",
      `EMAIL: ${result?.email || na}`,
      `PLAN: ${result?.plan || na}`,
      `COUNTRY: ${result?.countryOfSignup || na}`,
      `RENEWAL DATE: ${result?.nextBilling || na}`,
      `MEMBER SINCE: ${result?.memberSince || na}`,
      `PAYMENT: ${result?.paymentMethod || na}`,
      `PHONE: ${result?.phone || na}`,
    ];
    const copied = await copyTextToClipboard(lines.join("\n"));
    if (!copied) return;
    showAppToast(toast, {
      id: "checker-copy-details",
      title: "Details copied!",
      status: "success",
      duration: 1600,
    });
  };
  
  return (
    <Box
  as="main"
  minH="100vh"
  w="full"
  overflowX="hidden"
  bg="#0d0f18"
  color="#ffffff"
  pb={{ base: "140px", md: "180px" }}
>
      <Box
  mx="auto"
  w="full"
  maxW="1100px"
  px={{ base: 2, sm: 3, lg: 4 }}
  py={{ base: 2, sm: 3, lg: 6 }}
>
        <Grid gap={3}>
          <Box
  w="full"
  borderRadius="24px"
  borderWidth="1px"
  borderColor={sessionUnlocked ? "rgba(255,185,0,0.38)" : "rgba(120,60,220,0.22)"}
  bg={sessionUnlocked ? "linear-gradient(160deg, #1e1804 0%, #120f02 100%)" : "linear-gradient(160deg, #181e35 0%, #0f1220 100%)"}
  boxShadow={sessionUnlocked ? "0 0 0 1px rgba(255,185,0,0.14), 0 8px 32px rgba(0,0,0,0.8), 0 0 60px rgba(255,160,0,0.20)" : "0 0 0 1px rgba(120,60,220,0.10), 0 8px 32px rgba(0,0,0,0.7), 0 0 60px rgba(90,30,180,0.12)"}
  transition="border-color 0.6s ease, box-shadow 0.6s ease, background 0.6s ease"
  overflow="hidden"
>
            <Flex
  direction="column"
              overflow="hidden"
              borderRadius="24px"
              borderWidth="0"
              bg="transparent"
            >
              <Grid
                minH="40px"
                templateColumns="2.5rem 1fr 2.5rem"
                alignItems="center"
                borderBottomWidth="1px"
                borderBottomColor={sessionUnlocked ? "rgba(255,185,0,0.22)" : "rgba(120,60,220,0.18)"}
                bg={sessionUnlocked ? "rgba(20,15,3,0.7)" : "rgba(10,10,24,0.7)"}
                px={3}
              >
                <Box aria-hidden="true" display="flex" alignItems="center">
                  <SiNetflix color="#e50914" size="22px" />
                </Box>
                <Text
                  m={0}
                  noOfLines={1}
                  textAlign="center"
                  fontSize="xs"
                  fontWeight="700"
                  fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace"
                  letterSpacing="0.06em"
                  color={isPremiumPage ? "#e50914" : isTrialPage ? "#38bdf8" : "#ff8a3d"}
animation={isPremiumPage ? premiumAnimation : undefined}
                >
                  {isPremiumPage ? "PREMIUM" : isTrialPage ? "FREE TRIAL" : "FREE"}
                </Text>
                <Box aria-hidden="true" />
              </Grid>

              <Box
  as="form"
  onSubmit={runCheck}
  display="grid"
  gap={3}
  alignContent="start"
  p={{ base: 3, sm: 4 }}
>
                <Box
  position="relative"
  h={{ base: "160px", sm: "200px", md: "220px", lg: "260px" }}
  borderRadius="16px"
  bg="#141726"
>
                  {!isLoading && detectedCookieCount > 0 && (
                    <Badge
                      position="absolute"
                      top={2}
                      right={3}
                      zIndex={3}
                      borderRadius="full"
                      px={2}
                      py={0.5}
                      fontSize="10px"
                      fontWeight="700"
                      bg="rgba(0,213,99,0.12)"
                      color="#00d563"
                      borderWidth="1px"
                      borderColor="rgba(0,213,99,0.3)"
                      pointerEvents="none"
                      data-testid="badge-cookie-count"
                    >
                      {detectedCookieCount} cookie{detectedCookieCount !== 1 ? 's' : ''}
                    </Badge>
                  )}

                  {showUploadedFileMarker ? (
                    <HStack
                      position="absolute"
                      top={3}
                      left={4}
                      zIndex={2}
                      spacing={2}
                      align="center"
                      pointerEvents="none"
                      aria-hidden="true"
                    >
                      <Box w="2px" h="0.95rem" borderRadius="full" bg="#ff8a3d" />
                      <Text
                        m={0}
                        fontSize="0.68rem"
                        fontWeight="700"
                        fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace"
                        letterSpacing="0.06em"
                        color="#ff8a3d"
                      >
                        B-U-R-N
                      </Text>
                      <Text
                        m={0}
                        fontSize="0.66rem"
                        fontWeight="600"
                        fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace"
                        letterSpacing="0.05em"
                        color="rgba(255,255,255,0.6)"
                      >
                        cookies.input
                      </Text>
                    </HStack>
                  ) : null}

                  {!isLoading ? (
                    <Textarea
                      value={input}
                      onChange={handleCookieInputChange}
                      placeholder="$ paste netscape blocks, json cookie data, or raw/header cookie strings"
                      spellCheck={false}
                      h="100%"
                      minH="100%"
                      w="100%"
                      resize="none"
                      borderRadius="16px"
                      borderWidth="1px"
                      borderColor="rgba(255,255,255,0.1)"
                      bg="#0f1322"
                      px={4}
                      py={3}
                      pt={showUploadedFileMarker ? 9 : 3}
                      fontSize="sm"
                      fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace"
                      color="#ffffff"
                      _placeholder={{ color: "rgba(255,255,255,0.45)" }}
                      _hover={{
                        borderColor: "rgba(255,138,61,0.58)",
                        bg: "#101525",
                      }}
                      _focusVisible={{
                        borderColor: "rgba(255,138,61,0.78)",
                        boxShadow: "0 0 0 1px rgba(255,138,61,0.44)",
                        bg: "#101525",
                      }}
                    />
                  ) : (
                    <Box
                      ref={checkLogRef}
                      role="log"
                      aria-live="polite"
                      h="100%"
                      minH="100%"
                      overflow="auto"
                      borderRadius="16px"
                      borderWidth="1px"
                      borderColor="rgba(255,255,255,0.1)"
                      bg="#0f1322"
                      px={4}
                      py={3}
                      pt={showUploadedFileMarker ? 9 : 3}
                      fontSize="sm"
                      fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace"
                    >
                      {checkProgress.total > 0 && (
                        <HStack
                          justify="center"
                          spacing={4}
                          fontSize="xs"
                          fontFamily="mono"
                          py={1.5}
                          px={2}
                          borderRadius="8px"
                          bg="rgba(255,255,255,0.04)"
                          mb={2}
                          data-testid="stats-bar-live"
                        >
                          <Text m={0} color="#00d563" fontWeight="700">✓ {liveValidCount ?? 0} Valid</Text>
                          <Text m={0} color="#ff4d4d" fontWeight="700">✗ {liveInvalidCount ?? 0} Invalid</Text>
                          <Text m={0} color="rgba(255,255,255,0.4)">⏳ {Math.max(0, checkProgress.total - checkProgress.completed)} Left</Text>
                        </HStack>
                      )}
                      {checkLogs.length === 0 ? (
                        <Box m={0} pl={3} borderLeftWidth="2px" borderLeftColor="rgba(255,255,255,0.72)">
                          <Text m={0} color="rgba(255,255,255,0.8)">
                            Starting check...
                          </Text>
                        </Box>
                      ) : (
                        checkLogs.map((entry) => (
                          <Box
                            key={entry.id}
                            m={0}
                            mt={entry.id > 1 ? 1 : 0}
                            pl={3}
                            borderLeftWidth="2px"
                            borderLeftColor={getLogToneColor(entry.tone)}
                          >
                            <Text
                              m={0}
                              whiteSpace="pre-wrap"
                              wordBreak="break-word"
                              color={getLogToneColor(entry.tone)}
                            >
                              {entry.text}
                            </Text>
                          </Box>
                        ))
                      )}
                    </Box>
                  )}
                </Box>

                <Flex align="center" gap={3} justify="space-between">
                  <Box
                    borderWidth="1px"
                    borderColor="rgba(255,255,255,0.1)"
                    borderRadius="10px"
                    bg="#101525"
                    px={2.5}
                    py={1.5}
                    flexShrink={0}
                  >
                    <HStack spacing={2}>
                      <Text
                        fontSize="0.68rem"
                        fontWeight="700"
                        letterSpacing="0.09em"
                        textTransform="uppercase"
                        color="rgba(255,255,255,0.64)"
                      >
                        NFTOKEN
                      </Text>
                      <Switch
                        isChecked={checkNFToken}
                        onChange={toggleCheckNFToken}
                        isDisabled={isLoading}
                        colorScheme="purple"
                        size="sm"
                      />
                    </HStack>
                  </Box>

                  <HStack spacing={2} ml="auto" flexShrink={0}>
                    <Text
                      fontSize="0.68rem"
                      fontWeight="700"
                      letterSpacing="0.09em"
                      textTransform="uppercase"
                      color="rgba(255,255,255,0.64)"
                    >
                      Workers
                    </Text>
                    <HStack
                      spacing={1.5}
                      opacity={1}
                      pointerEvents="auto"
                    >
                      <Button
                        type="button"
                        onClick={decrementWorkerCount}
                        isDisabled={isLoading || workerCount <= minWorkerCount}
                        aria-label="Decrease worker count"
                        h="28px"
                        minW="28px"
                        p={0}
                        borderRadius="full"
                        borderWidth="1px"
                        borderColor="rgba(255,255,255,0.14)"
                        bg="#101525"
                        color="#ffffff"
                        fontSize="base"
                        lineHeight="none"
                        transition="transform 0.16s ease, background-color 0.16s ease"
                        _hover={{ bg: "rgba(255,255,255,0.08)", ...hoverLift }}
                        _active={{ transform: "translateY(0)" }}
                        _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                      >
                        &lt;
                      </Button>
                      <Text
                        minW="24px"
                        textAlign="center"
                        fontSize="sm"
                        fontWeight="600"
                        color="white"
                      >
                        {workerCount}
                      </Text>
                      <Button
                        type="button"
                        onClick={incrementWorkerCount}
                        isDisabled={isLoading || workerCount >= maxWorkerCount}
                        aria-label="Increase worker count"
                        h="28px"
                        minW="28px"
                        p={0}
                        borderRadius="full"
                        borderWidth="1px"
                        borderColor="rgba(255,255,255,0.14)"
                        bg="#101525"
                        color="#ffffff"
                        fontSize="base"
                        lineHeight="none"
                        transition="transform 0.16s ease, background-color 0.16s ease"
                        _hover={{ bg: "rgba(255,255,255,0.08)", ...hoverLift }}
                        _active={{ transform: "translateY(0)" }}
                        _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                      >
                        &gt;
                      </Button>
                    </HStack>
                  </HStack>
                </Flex>

                <VStack align="stretch" spacing={2}>
                  <Box
                    position="relative"
                    h="8px"
                    overflow="hidden"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor="rgba(255,255,255,0.1)"
                    bg="#101525"
                  >
                    <Box
                      position="absolute"
                      insetY={0}
                      left={0}
                      borderRadius="full"
                      bg="#ff8a3d"
                      w={isProgressIndeterminate ? "28%" : progressBarStyle?.width || "0%"}
                      animation={
                        isProgressIndeterminate
                          ? "terminal-progress-indeterminate 1.1s ease-in-out infinite"
                          : "none"
                      }
                      style={isProgressIndeterminate ? undefined : progressBarStyle}
                    />
                  </Box>
                  <Box
                    h="1px"
                    w="full"
                    bg="rgba(255,255,255,0.08)"
                    aria-hidden="true"
                  />
                </VStack>

                <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap={2}>
                  <Input
                    ref={uploadInputRef}
                    type="file"
                    accept={filePickerAccept}
                    display="none"
                    onChange={(event) => void handleUploadFile(event)}
                  />
                  <Button
                    type="submit"
                    onClick={(event) => {
                      if (!isLoading) return;
                      event.preventDefault();
                      stopCheck();
                    }}
                    minH="2.8rem"
                    borderRadius="12px"
                    borderWidth="1px"
                    borderColor="rgba(229,9,20,0.7)"
                    bg="#e50914"
                    color="#ffffff"
                    fontSize="sm"
                    fontWeight="700"
                    letterSpacing="0.07em"
                    textTransform="uppercase"
                    transition="transform 0.16s ease, background-color 0.16s ease"
                    _hover={{ bg: "#c8000f", ...hoverLift }}
                    _active={{ transform: "translateY(0)" }}
                  >
                    {isLoading ? "Stop" : "Start"}
                  </Button>

                  <Button
                    type="button"
                    onClick={openUploadPicker}
                    disabled={isLoading}
                    minH="2.8rem"
                    borderRadius="12px"
                    borderWidth="1px"
                    borderColor="rgba(26,86,219,0.7)"
                    bg="#1a56db"
                    color="#ffffff"
                    fontSize="sm"
                    fontWeight="700"
                    letterSpacing="0.07em"
                    textTransform="uppercase"
                    transition="transform 0.16s ease, background-color 0.16s ease"
                    _hover={{ bg: "#1546b8", ...hoverLift }}
                    _active={{ transform: "translateY(0)" }}
                    _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                  >
                    Upload File
                  </Button>

                  {(isFreePage || isPremiumPage) && (
  <Button
    type="button"
    gridColumn="span 2"
    onClick={runFindAccount}
    isDisabled={isLoading}
    minH="3.4rem"
    borderRadius="12px"
    borderWidth="1px"
    borderColor="rgba(255,200,30,0.7)"
    bg="linear-gradient(100deg, #5a3800 0%, #c8860a 28%, #ffe066 50%, #c8860a 72%, #5a3800 100%)"
    color="#fff8dc"
    fontSize="sm"
    fontWeight="800"
    letterSpacing="0.12em"
    textTransform="uppercase"
    boxShadow="0 0 18px rgba(255,185,0,0.45), 0 2px 10px rgba(0,0,0,0.55)"
    position="relative"
    overflow="hidden"
    transition="transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease"
    _hover={{
      filter: "brightness(1.18)",
      boxShadow: "0 0 30px rgba(255,185,0,0.7), 0 2px 14px rgba(0,0,0,0.55)",
      ...hoverLift,
    }}
    _active={{ transform: "translateY(0)" }}
    _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
    data-testid="button-find-account"
  >
    <Box
      position="absolute"
      inset={0}
      pointerEvents="none"
      aria-hidden="true"
      background="linear-gradient(105deg, transparent 30%, rgba(255,255,220,0.38) 50%, transparent 70%)"
      backgroundSize="200% 100%"
      animation={undefined}
    />
    <Box display="flex" flexDirection="column" alignItems="center" gap="2px" position="relative">
      <Box fontSize="xs" fontWeight="800" letterSpacing="0.12em">
        GENERATE ACCOUNT
      </Box>
    </Box>
  </Button>
)}

{(isFreePage || isTrialPage) && (
  <Button
    type="button"
    gridColumn="span 2"
    onClick={() => runTrial?.()}
    isDisabled={isLoading}
    minH="3.4rem"
    borderRadius="12px"
    borderWidth="1px"
    borderColor="rgba(56,189,248,0.65)"
    bg="linear-gradient(100deg, #082f49 0%, #0369a1 28%, #38bdf8 50%, #0369a1 72%, #082f49 100%)"
    color="#eff6ff"
    fontSize="sm"
    fontWeight="800"
    letterSpacing="0.12em"
    textTransform="uppercase"
    boxShadow="0 0 18px rgba(56,189,248,0.35), 0 2px 10px rgba(0,0,0,0.55)"
    position="relative"
    overflow="hidden"
    transition="transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease"
    _hover={{
      filter: "brightness(1.12)",
      boxShadow: "0 0 30px rgba(56,189,248,0.55), 0 2px 14px rgba(0,0,0,0.55)",
      ...hoverLift,
    }}
    _active={{ transform: "translateY(0)" }}
    _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
    data-testid="button-trial"
  >
    <Box
      position="absolute"
      inset={0}
      pointerEvents="none"
      aria-hidden="true"
      background="linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)"
      backgroundSize="200% 100%"
      animation={shimmerAnimation}
    />
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="2px"
      position="relative"
    >
      <Box fontSize="xs" fontWeight="800" letterSpacing="0.12em">
        FREE TRIAL
      </Box>
    </Box>
  </Button>
)}
                </Grid>
              </Box>
            </Flex>
          </Box>

          <AppCredits />
        </Grid>
      </Box>

      {isFreePage && (
  <Box
    position="relative"
    mt={6}
    mx="auto"
    zIndex={1}
    display="flex"
    flexDirection="column"
    alignItems="center"
    gap={1}
  >
        <Text
          fontSize="11px"
          fontWeight="600"
          letterSpacing="0.04em"
          color="rgba(255,255,255,0.55)"
          textAlign="center"
          userSelect="none"
          lineHeight="1.5"
        >
          For premium code's<br />Just message me on my social platforms.
        </Text>
        <Box display="flex" flexDirection="row" gap={4} alignItems="flex-end">

          {/* Facebook column */}
          <Box display="flex" flexDirection="column" alignItems="center" gap="3px">
            <Box
              animation={arrowBounceAnimation}
              lineHeight="1"
              fontSize="14px"
              color="rgba(24,119,242,0.85)"
              userSelect="none"
              aria-hidden="true"
            >↓</Box>
            <Box
              as="a"
              href="https://www.facebook.com/burn024/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="42px"
              h="42px"
              borderRadius="full"
              bg="rgba(10,12,28,0.82)"
              borderWidth="1px"
              borderColor="rgba(24,119,242,0.35)"
              boxShadow="0 0 12px rgba(24,119,242,0.18)"
              animation={bobAnimation}
              transition="box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease"
              _hover={{ bg: "rgba(24,119,242,0.18)", borderColor: "rgba(24,119,242,0.75)", boxShadow: "0 0 22px rgba(24,119,242,0.55)" }}
              cursor="pointer"
              data-testid="link-facebook"
            >
              <SiFacebook color="#1877F2" size="20px" />
            </Box>
          </Box>

          {/* Telegram column */}
          <Box display="flex" flexDirection="column" alignItems="center" gap="3px">
            <Box
              animation={arrowBounceAnimation}
              style={{ animationDelay: "0.33s" }}
              lineHeight="1"
              fontSize="14px"
              color="rgba(34,158,217,0.85)"
              userSelect="none"
              aria-hidden="true"
            >↓</Box>
            <Box
              as="a"
              href="https://t.me/BURNx24"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="42px"
              h="42px"
              borderRadius="full"
              bg="rgba(10,12,28,0.82)"
              borderWidth="1px"
              borderColor="rgba(34,158,217,0.35)"
              boxShadow="0 0 12px rgba(34,158,217,0.18)"
              animation={bobAnimation}
              style={{ animationDelay: "0.9s" }}
              transition="box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease"
              _hover={{ bg: "rgba(34,158,217,0.18)", borderColor: "rgba(34,158,217,0.75)", boxShadow: "0 0 22px rgba(34,158,217,0.55)" }}
              cursor="pointer"
              data-testid="link-telegram"
            >
              <SiTelegram color="#229ED9" size="20px" />
            </Box>
          </Box>

          

        </Box>
      </Box>
)}
      <Modal
  isOpen={isBulkModalOpen && !isMinimized}
  onClose={() => setIsBulkModalOpen(false)}
  isCentered
  size={{ base: "full", md: "3xl" }}
>
  <ModalOverlay bg="rgba(0,0,0,0.62)" backdropFilter="blur(2px)" />

  <ModalContent
    bg={sessionUnlocked
      ? "linear-gradient(160deg, #0d1410 0%, #091008 100%)"
      : "linear-gradient(160deg, #181e35 0%, #0f1220 100%)"
    }
    borderWidth="1px"
    borderColor={sessionUnlocked ? "rgba(0,213,99,0.28)" : "rgba(120,60,220,0.22)"}
    boxShadow={sessionUnlocked
      ? "0 0 0 1px rgba(0,213,99,0.12), 0 16px 48px rgba(0,0,0,0.8), 0 0 80px rgba(0,213,99,0.10)"
      : "0 0 0 1px rgba(120,60,220,0.10), 0 16px 48px rgba(0,0,0,0.8), 0 0 80px rgba(90,30,180,0.15)"
    }
    color="#ffffff"
    mx={{ base: 0, md: 3 }}
    borderRadius={{ base: 0, md: "20px" }}
  >
    <ModalHeader
      borderBottomWidth="1px"
      borderBottomColor={sessionUnlocked ? "rgba(0,213,99,0.18)" : "rgba(120,60,220,0.18)"}
      fontSize="sm"
      letterSpacing="0.1em"
      textTransform="uppercase"
      color={sessionUnlocked ? "#00d563" : "#c084fc"}
      pr="80px"
    >
      <HStack spacing={2} align="center">
        <Text>{showHistory ? "📚 History" : `Valid Accounts (${bulkValidResults?.length || 0})`}</Text>
        {sessionUnlocked && (
          <HStack spacing={1}>
            {!showHistory && bulkValidResults?.length > 0 && (
              <Button
                size="xs"
                variant="ghost"
                color={bulkRecheckState.done === bulkRecheckState.total && bulkRecheckState.total > 0 && !bulkRecheckState.loading
                  ? "#00d563"
                  : bulkRecheckState.loading ? "#f6c90e" : "rgba(255,255,255,0.4)"}
                fontSize="11px"
                px={1.5}
                minW="auto"
                h="auto"
                py={0.5}
                title="Re-check all found accounts"
                isDisabled={bulkRecheckState.loading}
                onClick={handleRecheckAll}
                data-testid="button-recheck-all"
                _hover={{ color: "#00d563" }}
              >
                {bulkRecheckState.loading
                  ? `⏳ ${bulkRecheckState.done}/${bulkRecheckState.total}`
                  : bulkRecheckState.done > 0 && bulkRecheckState.done === bulkRecheckState.total
                  ? "✓ Done"
                  : "🔄 All"}
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              color={showHistory ? "#ffe066" : "rgba(255,255,255,0.4)"}
              fontSize="13px"
              px={1}
              minW="auto"
              h="auto"
              py={0.5}
              title="Account history"
              onClick={() => setShowHistory(h => !h)}
              data-testid="button-history-toggle"
              _hover={{ color: "#ffe066" }}
            >
              📚{accountHistory.length > 0 && <Text as="span" fontSize="9px" ml="1px">{accountHistory.length}</Text>}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              color={soundEnabled ? "#00d563" : "rgba(255,255,255,0.3)"}
              fontSize="13px"
              px={1}
              minW="auto"
              h="auto"
              py={0.5}
              title="Toggle success sound"
              onClick={toggleSound}
              data-testid="button-sound-toggle"
              _hover={{ color: soundEnabled ? "#00d563" : "rgba(255,255,255,0.6)" }}
            >
              {soundEnabled ? "🔔" : "🔕"}
            </Button>
          </HStack>
        )}
      </HStack>
    </ModalHeader>

    <Box position="absolute" top="10px" right="44px" zIndex={10}>
      <Button
        variant="ghost"
        size="sm"
        h="32px"
        w="32px"
        p={0}
        minW="auto"
        borderRadius="6px"
        color="rgba(255,255,255,0.6)"
        fontSize="lg"
        fontWeight="700"
        lineHeight="1"
        title="Minimize"
        onClick={() => setIsMinimized(true)}
        data-testid="button-minimize-modal"
        _hover={{ color: "white", bg: "rgba(255,255,255,0.08)" }}
      >
        −
      </Button>
    </Box>

    <ModalCloseButton />

    <ModalBody p={{ base: 3, sm: 4 }} maxH="70vh" overflowY="auto">
  {showHistory ? (
    <Box>
      <HStack justify="space-between" mb={3}>
        <Text fontSize="xs" color="rgba(255,255,255,0.45)" letterSpacing="0.1em" textTransform="uppercase">
          {accountHistory.length} saved account{accountHistory.length !== 1 ? 's' : ''} (last 100)
        </Text>
        {accountHistory.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            color="rgba(255,77,77,0.7)"
            fontSize="11px"
            _hover={{ color: "#ff4d4d" }}
            onClick={() => {
              setAccountHistory([]);
              localStorage.removeItem('netflix-checker:history:v1');
            }}
            data-testid="button-clear-history"
          >
            🗑 Clear
          </Button>
        )}
      </HStack>
      {accountHistory.length === 0 && (
        <Text fontSize="sm" color="rgba(255,255,255,0.3)" textAlign="center" py={8}>
          No saved accounts yet
        </Text>
      )}
      {accountHistory.map((result, index) => {
        const theme = getPlanTheme(result?.plan);
        const expiryBadge = getExpiryBadge(result?.nextBilling);
        return (
          <Box
            key={index}
            mb={3}
            borderRadius="14px"
            borderWidth="1px"
            borderColor={theme.border}
            bg={theme.bg}
            opacity={0.85}
            overflow="hidden"
          >
            <Box px={4} pt={3} pb={2}>
              <HStack justify="space-between" flexWrap="wrap">
                <HStack spacing={2}>
                  <Text fontSize="xs" color="rgba(255,255,255,0.3)" fontFamily="mono"># {index + 1}</Text>
                  <Text fontSize="sm" fontWeight="700" color={theme.accent} textTransform="uppercase" letterSpacing="0.08em">
                    {displayValue(result?.email, displayValue(result?.plan, 'Account'))}
                  </Text>
                </HStack>
                <HStack spacing={1}>
                  {expiryBadge && (
                    <Badge bg={expiryBadge.bg} color={expiryBadge.color} fontSize="9px" borderRadius="full" px={2} py={0.5} borderWidth="1px" borderColor={expiryBadge.color}>
                      {expiryBadge.label}
                    </Badge>
                  )}
                  <Badge bg={theme.badgeColor} color="white" fontSize="9px" borderRadius="full" px={2} fontWeight="800">
                    {theme.badgeText}
                  </Badge>
                </HStack>
              </HStack>
              <Text fontSize="10px" color="rgba(255,255,255,0.28)" mt={1}>
                Found: {result?.savedAt ? new Date(result.savedAt).toLocaleString() : 'Unknown'} {result?.countryOfSignup ? `· ${getCountryFlag(result.countryOfSignup)} ${result.countryOfSignup}` : ''}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  ) : null}
  {!showHistory && bulkValidResults?.map((result, index) => {
    if (sessionUnlocked) {
      const premiumFields = [
        ["EMAIL", result?.email],
        ["PLAN", result?.plan],
        ["COUNTRY", result?.countryOfSignup],
        ["RENEWAL DATE", result?.nextBilling],
        ["MEMBER SINCE", result?.memberSince],
        ["PAYMENT", result?.paymentMethod],
        ["PHONE", result?.phone],
      ];

      const theme = getPlanTheme(result?.plan);
      const expiryBadge = getExpiryBadge(result?.nextBilling);
      const recheckState = recheckStates[index] || {};
      const grade = getAccountGrade(result);
      const isLive = liveResultIds?.has(result?.cookieHeader);
      return (
        <Box
          key={index}
          mb={4}
          borderRadius="16px"
          borderWidth="1.5px"
          borderColor={theme.border}
          bg={theme.bg}
          animation={theme.glowAnim}
          overflow="hidden"
        >
          <Box px={4} pt={4} pb={2}>
            <HStack spacing={2} mb={2} justify="space-between" flexWrap="wrap">
              <HStack spacing={2}>
                <Text fontSize="xs" color="rgba(255,255,255,0.35)" fontFamily="mono" fontWeight="700">
                  #{index + 1}
                </Text>
                {isLive && (
                  <HStack spacing={1} align="center">
                    <Box as="span" animation={pulseRedAnim} fontSize="9px" lineHeight="1" display="inline-block">🔴</Box>
                    <Text fontSize="9px" color="#ff4d4d" fontWeight="800" letterSpacing="0.08em">LIVE</Text>
                  </HStack>
                )}
                <Text fontSize="lg" color={theme.accent} lineHeight="1" fontWeight="900">✓</Text>
                <Text fontWeight="700" fontSize="sm" letterSpacing="0.1em" textTransform="uppercase" color={theme.accent}>
                  VALID ACCOUNT
                </Text>
              </HStack>
              <HStack spacing={1} flexWrap="wrap">
                <Badge
                  bg={grade.bg}
                  color={grade.color}
                  fontSize="9px"
                  fontWeight="900"
                  borderRadius="full"
                  px={2}
                  py={0.5}
                  borderWidth="1px"
                  borderColor={grade.color}
                  letterSpacing="0.05em"
                >
                  {grade.grade}
                </Badge>
                {expiryBadge && (
                  <Badge
                    bg={expiryBadge.bg}
                    color={expiryBadge.color}
                    fontSize="9px"
                    fontWeight="800"
                    borderRadius="full"
                    px={2}
                    py={0.5}
                    borderWidth="1px"
                    borderColor={expiryBadge.color}
                  >
                    {expiryBadge.label}
                  </Badge>
                )}
                <Badge
                  bg={theme.badgeColor}
                  color="white"
                  fontSize="9px"
                  fontWeight="800"
                  letterSpacing="0.1em"
                  borderRadius="full"
                  px={2}
                  py={0.5}
                >
                  {theme.badgeText}
                </Badge>
              </HStack>
            </HStack>
            <Box borderBottomWidth="1px" borderBottomColor="rgba(255,255,255,0.1)" />
          </Box>

          <Box px={4} pb={2} pt={2}>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
              {premiumFields.map(([label, value]) =>
                value ? (
                  <Box
                    key={label}
                    bg="rgba(255,255,255,0.04)"
                    borderRadius="10px"
                    px={3}
                    py={2.5}
                  >
                    <Text fontSize="10px" letterSpacing="0.12em" color="rgba(255,255,255,0.4)" fontWeight="600" textTransform="uppercase" mb={0.5}>
                      {label}:
                    </Text>
                    <Text fontSize="sm" fontWeight="600" color="rgba(255,255,255,0.92)">
                      {label === "COUNTRY"
                        ? `${getCountryFlag(value)} ${displayValue(value)}`
                        : displayValue(value)
                      }
                    </Text>
                  </Box>
                ) : null
              )}
            </SimpleGrid>
          </Box>

          <Box px={4} pb={2}>
            <HStack spacing={2}>
              <Button
                size="xs"
                variant="outline"
                borderColor="rgba(255,255,255,0.2)"
                color="rgba(255,255,255,0.65)"
                borderRadius="8px"
                fontSize="xs"
                isDisabled={recheckState.loading}
                onClick={() => handleRecheck(index, result?.cookieHeader)}
                data-testid={`button-recheck-${index}`}
                _hover={{ borderColor: theme.accent, color: theme.accent }}
              >
                {recheckState.loading ? "⏳ Checking..." : "🔄 Re-check"}
              </Button>
              {recheckState.result !== null && recheckState.result !== undefined && (
                <Badge
                  borderRadius="full"
                  px={2}
                  py={0.5}
                  fontSize="9px"
                  fontWeight="800"
                  bg={recheckState.result?.valid ? "rgba(0,213,99,0.15)" : "rgba(255,77,77,0.15)"}
                  color={recheckState.result?.valid ? "#00d563" : "#ff4d4d"}
                  borderWidth="1px"
                  borderColor={recheckState.result?.valid ? "#00d563" : "#ff4d4d"}
                >
                  {recheckState.result?.valid ? "✓ Still Live!" : "✗ No Longer Live"}
                </Badge>
              )}
              {recheckState.error && (
                <Badge borderRadius="full" px={2} fontSize="9px" bg="rgba(255,77,77,0.15)" color="#ff4d4d">
                  ✗ Check Failed
                </Badge>
              )}
            </HStack>
          </Box>

          <HStack px={4} pb={3} spacing={2}>
            <Button
              flex={1}
              bg={copiedStates[`${index}-pc`] ? "linear-gradient(90deg,#00c853,#00e676)" : "linear-gradient(90deg, #00d563 0%, #00b050 100%)"}
              color="white"
              fontWeight="700"
              borderWidth="0"
              borderRadius="10px"
              fontSize="xs"
              py={5}
              _hover={{ filter: "brightness(1.15)" }}
              onClick={() => handleCopyWithFeedback(`${index}-pc`, () => handlePcCopy(readResultTokenLink(result)))}
              data-testid={`button-pc-${index}`}
            >
              {copiedStates[`${index}-pc`] ? "✓ Copied!" : "🖥 PC Watch"}
            </Button>
            <Button
              flex={1}
              bg={copiedStates[`${index}-android`] ? "linear-gradient(90deg,#00c853,#00e676)" : "linear-gradient(90deg, #1a56db 0%, #6c47ff 100%)"}
              color="white"
              fontWeight="700"
              borderWidth="0"
              borderRadius="10px"
              fontSize="xs"
              py={5}
              _hover={{ filter: "brightness(1.15)" }}
              onClick={() => handleCopyWithFeedback(`${index}-android`, () => handleAndroidCopy(readResultTokenLink(result)))}
              data-testid={`button-android-${index}`}
            >
              {copiedStates[`${index}-android`] ? "✓ Copied!" : "📱 Mobile Watch"}
            </Button>
            <Button
  flex={1}
  bg="linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)"
  color="white"
  fontWeight="700"
  borderWidth="0"
  borderRadius="10px"
  fontSize="xs"
  py={5}
  _hover={{ filter: "brightness(1.15)" }}
  onClick={() => handleTvOpen(readResultTokenLink(result))}
  data-testid={`button-tv-${index}`}
>
  📺 TV Connect
</Button>
          </HStack>

                             <Box px={4} pb={4}>
            <Button
              variant="outline"
              borderStyle="dashed"
              borderColor="rgba(255,255,255,0.22)"
              color="rgba(255,255,255,0.75)"
              borderRadius="10px"
              fontSize="sm"
              w="full"
              _hover={{ borderColor: theme.border, color: theme.accent }}
              onClick={() => setShowGuide(!showGuide)}
            >
            click this  📡 ACCESS GUIDE {showGuide ? "▲" : "▼"}
            </Button>

            {showGuide && (
              <Box
                mt={3}
                border="1px dashed rgba(255,255,255,0.22)"
                borderRadius="10px"
                p={4}
                bg="rgba(0,0,0,0.3)"
                color="rgba(255,255,255,0.85)"
                fontSize="sm"
              >
                <Box textAlign="center" fontWeight="bold" mb={3}>
                  📡 ACCESS GUIDE
                </Box>

                <Box mb={3}>
                  <b>• 💻 PC WATCH</b><br />
                  Open your browser and paste the provided link to access the account.
                </Box>

                <Box borderTop="1px dashed rgba(255,255,255,0.15)" my={2} />

                <Box mb={3}>
                  <b>• 📱 MOBILE WATCH</b><br />
                  Make sure you have the Netflix app installed.<br />
                  Ensure there is no other Netflix account logged in on your app or browser.<br />
                  Paste the provided link into your main browser (Chrome/Safari).<br />
                  You will be redirected to Netflix — tap the “Open in App” button.<br />
                  <i>Note: Language may vary depending on account country.</i>
                </Box>

                <Box borderTop="1px dashed rgba(255,255,255,0.15)" my={2} />

                <Box mb={3}>
                  <b>• 📺 TV CONNECT</b><br />
                  Open Netflix on your Smart TV and choose <b>Login via Code</b>.<br />
                  Paste the TV Connect link into your browser.<br />
                  Then replace the link with:<br />
                  <b>www.netflix.com/tv2</b><br />
                  Enter the code shown on your TV screen.
                </Box>

                <Box borderTop="1px dashed rgba(255,255,255,0.15)" my={2} />

                <Box>
                  <b>• 🔄 RE-CHECK</b><br />
                  Refresh and verify the account before using it.
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      );
    }

    const modalDetailItems = [
      ["Plan", result?.plan],
      ["Country", result?.countryOfSignup],
      ["Price", result?.price],
      ["Membership", result?.membershipStatus],
      ["Member Since", result?.memberSince],
      ["Next Billing", result?.nextBilling],
      ["Email", result?.email],
      ["Email Verified", displayBoolean(result?.emailVerified)],
      ["Phone", result?.phone],
      ["Phone Verified", displayBoolean(result?.phoneVerified)],
    ];

    return (
      <Box
        key={index}
        mb={4}
        borderRadius="16px"
        borderWidth="1px"
        borderColor="rgba(120,60,220,0.5)"
        bg="linear-gradient(135deg, #181e35 0%, #111827 100%)"
        animation={prefersReducedMotion ? undefined : `${cardGlowPurpleKf} 2.5s ease-in-out infinite`}
        overflow="hidden"
      >
        <Box
          h="3px"
          bg="linear-gradient(90deg, #e50914 0%, #7c3aed 50%, #1a56db 100%)"
        />
        <Box p={4}>
          <HStack justify="space-between" mb={3}>
            <HStack spacing={2}>
              <Text fontSize="xs" color="rgba(255,255,255,0.35)" fontFamily="mono" fontWeight="700">
                #{index + 1}
              </Text>
              <Text fontWeight="700" fontSize="md" color="#c084fc">
                {displayValue(result.plan)}
              </Text>
            </HStack>
            <Badge
              bg="#7c3aed"
              color="white"
              fontSize="9px"
              fontWeight="800"
              letterSpacing="0.1em"
              borderRadius="full"
              px={2}
              py={0.5}
            >
              VALID
            </Badge>
          </HStack>

          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
            {modalDetailItems.map(([label, value], i) =>
              value ? (
                <Text key={i} fontSize="sm" color="rgba(255,255,255,0.85)">
                  <Box as="span" color="rgba(255,255,255,0.45)" fontWeight="600">{label}: </Box>
                  {displayValue(value)}
                </Text>
              ) : null
            )}
          </SimpleGrid>

          <HStack mt={4} spacing={3}>
            <Button
              flex={1}
              bg={copiedStates[`${index}-android`] ? "linear-gradient(90deg,#00c853,#00e676)" : "linear-gradient(90deg, #1a56db 0%, #6c47ff 100%)"}
              color="white"
              fontWeight="700"
              borderWidth="0"
              borderRadius="10px"
              fontSize="sm"
              _hover={{ filter: "brightness(1.15)" }}
              onClick={() => handleCopyWithFeedback(`${index}-android`, () => handleAndroidCopy(readResultTokenLink(result)))}
              data-testid={`button-std-android-${index}`}
            >
              {copiedStates[`${index}-android`] ? "✓ Copied!" : "📱 Mobile"}
            </Button>

            <Button
              flex={1}
              bg={copiedStates[`${index}-pc`] ? "linear-gradient(90deg,#00c853,#00e676)" : "linear-gradient(90deg, #00d563 0%, #00b050 100%)"}
              color="white"
              fontWeight="700"
              borderWidth="0"
              borderRadius="10px"
              fontSize="sm"
              _hover={{ filter: "brightness(1.15)" }}
              onClick={() => handleCopyWithFeedback(`${index}-pc`, () => handlePcCopy(readResultTokenLink(result)))}
              data-testid={`button-std-pc-${index}`}
            >
              {copiedStates[`${index}-pc`] ? "✓ Copied!" : "🖥 PC Watch"}
            </Button>
          </HStack>
        </Box>
      </Box>
    );
  })}
</ModalBody>

{sessionUnlocked && !isLoading && bulkValidResults?.length > 0 && (
  <ModalFooter
    borderTopWidth="1px"
    borderTopColor="rgba(0,213,99,0.15)"
    pt={3}
    pb={4}
    px={4}
  >
    <HStack w="full" spacing={2}>
      <Button
        flex={1}
        borderRadius="12px"
        fontWeight="800"
        fontSize="sm"
        py={5}
        letterSpacing="0.08em"
        bg={copyAllDone
          ? "linear-gradient(90deg,#00c853,#00e676)"
          : "linear-gradient(90deg, #b8860b 0%, #ffe066 50%, #b8860b 100%)"
        }
        color={copyAllDone ? "white" : "#1a0a00"}
        _hover={{ filter: "brightness(1.12)" }}
        onClick={async () => {
          const allCookies = bulkValidResults
            .map(r => r.cookieHeader)
            .filter(Boolean)
            .join('\n');
          await copyTextToClipboard(allCookies);
          setCopyAllDone(true);
          setTimeout(() => setCopyAllDone(false), 1800);
        }}
        data-testid="button-copy-all"
      >
        {copyAllDone ? "✓ All Cookies Copied!" : `📋 COPY ALL`}
      </Button>
      <Button
        flex={1}
        borderRadius="12px"
        fontWeight="800"
        fontSize="sm"
        py={5}
        letterSpacing="0.08em"
        variant="outline"
        borderColor="rgba(255,255,255,0.25)"
        color="rgba(255,255,255,0.75)"
        _hover={{ borderColor: "#ffe066", color: "#ffe066" }}
        onClick={handleDownloadCookies}
        data-testid="button-download-cookies"
      >
        ⬇ .txt
      </Button>
      <Button
        flex={1}
        borderRadius="12px"
        fontWeight="800"
        fontSize="sm"
        py={5}
        letterSpacing="0.08em"
        variant="outline"
        borderColor="rgba(255,255,255,0.20)"
        color="rgba(255,255,255,0.65)"
        _hover={{ borderColor: "#00d563", color: "#00d563" }}
        onClick={handleExportCsv}
        data-testid="button-export-csv"
      >
        📊 .csv
      </Button>
    </HStack>
  </ModalFooter>
)}

</ModalContent>
</Modal>

{isBulkModalOpen && isMinimized && (
  <Box
    position="fixed"
    bottom="24px"
    right="24px"
    zIndex={1400}
    data-testid="pill-minimized-modal"
  >
    <Button
      onClick={() => setIsMinimized(false)}
      borderRadius="full"
      px={5}
      h="44px"
      bg={sessionUnlocked
        ? "linear-gradient(135deg, #0d1a12 0%, #091008 100%)"
        : "linear-gradient(135deg, #181e35 0%, #0f1220 100%)"}
      borderWidth="1.5px"
      borderColor={sessionUnlocked ? "rgba(0,213,99,0.55)" : "rgba(120,60,220,0.55)"}
      boxShadow={sessionUnlocked
        ? "0 4px 24px rgba(0,213,99,0.22), 0 8px 32px rgba(0,0,0,0.8)"
        : "0 4px 24px rgba(120,60,220,0.22), 0 8px 32px rgba(0,0,0,0.8)"}
      color={sessionUnlocked ? "#00d563" : "#c084fc"}
      fontWeight="700"
      fontSize="xs"
      letterSpacing="0.08em"
      _hover={{
        borderColor: sessionUnlocked ? "#00d563" : "#c084fc",
        filter: "brightness(1.2)",
      }}
      title="Restore"
      data-testid="button-restore-modal"
    >
      <HStack spacing={2}>
        <Text m={0} fontSize="sm">{showHistory ? "📚" : "✓"}</Text>
        <Text m={0}>
          {showHistory
            ? `History (${accountHistory.length})`
            : `${bulkValidResults?.length || 0} Account${(bulkValidResults?.length || 0) !== 1 ? 's' : ''}`}
        </Text>
        <Text m={0} fontSize="10px" opacity={0.55}>▲</Text>
      </HStack>
    </Button>
  </Box>
)}

      <Modal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
        isCentered
        size="sm"
      >
        <ModalOverlay bg="rgba(0,0,0,0.75)" backdropFilter="blur(4px)" />
        <ModalContent
          bg="linear-gradient(160deg, #181e35 0%, #0f1220 100%)"
          borderWidth="1px"
          borderColor="rgba(120,60,220,0.3)"
          borderRadius="20px"
          boxShadow="0 0 0 1px rgba(120,60,220,0.12), 0 20px 60px rgba(0,0,0,0.9)"
          overflow="hidden"
          mx={4}
        >
          <Box h="3px" bg="linear-gradient(90deg, #e50914 0%, #7c3aed 50%, #1a56db 100%)" />
          <ModalCloseButton color="rgba(255,255,255,0.5)" top={4} right={4} />
          <ModalHeader
            pt={6}
            pb={0}
            textAlign="center"
            color="#c084fc"
            fontSize="lg"
            fontWeight="800"
            letterSpacing="0.12em"
            textTransform="uppercase"
          >
            PREMIUM CODE
          </ModalHeader>
          <ModalBody pb={6} pt={4}>
            <VStack spacing={4}>
              <Input
                type="password"
                placeholder="Premium Code"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasscodeSubmit()}
                bg="rgba(255,255,255,0.05)"
                borderColor="rgba(255,255,255,0.1)"
                borderRadius="12px"
                color="white"
                _placeholder={{ color: "rgba(255,255,255,0.3)" }}
                _focus={{ borderColor: "#7c3aed", boxShadow: "0 0 0 1px #7c3aed" }}
                data-testid="input-find-passcode"
                autoFocus
              />
              {passcodeError && (
                <Text color="#e50914" fontSize="sm" textAlign="center" w="full">
                  {passcodeError}
                </Text>
              )}
              <Button
                w="full"
                onClick={handlePasscodeSubmit}
                isLoading={passcodeLoading}
                isDisabled={!passcodeInput.trim()}
                bg="linear-gradient(135deg, #6a35e8 0%, #a855f7 100%)"
                color="white"
                fontWeight="700"
                letterSpacing="0.08em"
                borderRadius="12px"
                borderWidth="0"
                _hover={{ filter: "brightness(1.15)" }}
                _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                data-testid="button-unlock-find-account"
              >
                Unlock
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
<Modal
  isOpen={isTrialModalOpen}
  onClose={() => setIsTrialModalOpen(false)}
  isCentered
  size="sm"
>
  <ModalOverlay bg="rgba(0,0,0,0.75)" backdropFilter="blur(4px)" />
  <ModalContent
    bg="linear-gradient(160deg, #0f1f33 0%, #0a1424 100%)"
    borderWidth="1px"
    borderColor="rgba(56,189,248,0.35)"
    borderRadius="20px"
    boxShadow="0 0 0 1px rgba(56,189,248,0.12), 0 20px 60px rgba(0,0,0,0.9)"
    overflow="hidden"
    mx={4}
  >
    <Box h="3px" bg="linear-gradient(90deg, #0ea5e9 0%, #38bdf8 50%, #1d4ed8 100%)" />
    <ModalCloseButton color="rgba(255,255,255,0.5)" top={4} right={4} />
    <ModalHeader
      pt={6}
      pb={0}
      textAlign="center"
      color="#38bdf8"
      fontSize="lg"
      fontWeight="800"
      letterSpacing="0.12em"
      textTransform="uppercase"
    >
      FREE TRIAL CODE
    </ModalHeader>
    <ModalBody pb={6} pt={4}>
      <VStack spacing={4}>
        <Input
          type="password"
          placeholder="Trial Code"
          value={trialCodeInput}
          onChange={(e) => setTrialCodeInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTrialSubmit()}
          bg="rgba(255,255,255,0.05)"
          borderColor="rgba(255,255,255,0.1)"
          borderRadius="12px"
          color="white"
          _placeholder={{ color: "rgba(255,255,255,0.3)" }}
          _focus={{ borderColor: "#38bdf8", boxShadow: "0 0 0 1px #38bdf8" }}
          autoFocus
        />
        {trialCodeError && (
          <Text color="#38bdf8" fontSize="sm" textAlign="center" w="full">
            {trialCodeError}
          </Text>
        )}
        <Button
          w="full"
          onClick={handleTrialSubmit}
          isLoading={trialLoading}
          isDisabled={!trialCodeInput.trim()}
          bg="linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)"
          color="white"
          fontWeight="700"
          letterSpacing="0.08em"
          borderRadius="12px"
          borderWidth="0"
          _hover={{ filter: "brightness(1.15)" }}
          _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          Unlock Trial
        </Button>
      </VStack>
    </ModalBody>
  </ModalContent>
</Modal>
</Box>

);
}
