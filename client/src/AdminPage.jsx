import React, { useState, useEffect, useCallback } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";

const MAX_PASSCODES = 50;

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const array = new Uint8Array(8);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPage() {
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminCode, setAdminCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [passcodes, setPasscodes] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [abuseLog, setAbuseLog] = useState([]);
  const [abuseLoading, setAbuseLoading] = useState(false);
  const [clearingLog, setClearingLog] = useState(false);

  const [cookieCount, setCookieCount] = useState(null);

  useEffect(() => {
    fetch("/api/admin/status", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data.isAdmin === true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const fetchPasscodes = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/passcodes", { credentials: "include" });
      const data = await res.json();
      setPasscodes(data.passcodes ?? []);
    } catch {
      toast({ title: "Failed to load passcodes.", status: "error", duration: 3000 });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchPasscodes();
  }, [isAdmin]);

  const fetchAbuseLog = useCallback(async () => {
    setAbuseLoading(true);
    try {
      const res = await fetch("/api/admin/abuse-log", { credentials: "include" });
      const data = await res.json();
      setAbuseLog(data.entries ?? []);
    } catch {
      toast({ title: "Failed to load abuse log.", status: "error", duration: 3000 });
    } finally {
      setAbuseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAbuseLog();
  }, [isAdmin]);

  const fetchCookieCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cookie-count", { credentials: "include" });
      const data = await res.json();
      setCookieCount(data.count ?? 0);
    } catch {
      setCookieCount(0);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchCookieCount();
  }, [isAdmin]);

  const handleClearLog = async () => {
    setClearingLog(true);
    try {
      await fetch("/api/admin/abuse-log", { method: "DELETE", credentials: "include" });
      setAbuseLog([]);
      toast({ title: "Abuse log cleared.", status: "success", duration: 1800 });
    } catch {
      toast({ title: "Failed to clear log.", status: "error", duration: 3000 });
    } finally {
      setClearingLog(false);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdmin(true);
      } else {
        setLoginError(data.error || "Incorrect code.");
      }
    } catch {
      setLoginError("Network error. Try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdd = async () => {
    const code = newCode.trim();
    if (!code) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/passcodes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, expiresAt: newExpiry || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewCode("");
        setNewExpiry("");
        await fetchPasscodes();
        toast({ title: "Passcode added.", status: "success", duration: 2000 });
      } else {
        toast({ title: data.error || "Failed to add.", status: "error", duration: 3000 });
      }
    } catch {
      toast({ title: "Network error.", status: "error", duration: 3000 });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/admin/passcodes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setPasscodes((prev) => prev.filter((p) => p.id !== id));
        toast({ title: "Passcode deleted.", status: "success", duration: 1800 });
      }
    } catch {
      toast({ title: "Failed to delete.", status: "error", duration: 3000 });
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", status: "success", duration: 1500 });
    });
  };

  const inputStyle = {
    bg: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "white",
    _placeholder: { color: "rgba(255,255,255,0.3)" },
    _focus: { borderColor: "#7c3aed", boxShadow: "0 0 0 1px #7c3aed" },
  };

  if (checking) {
    return (
      <Flex h="100vh" bg="#08080f" align="center" justify="center">
        <Text color="gray.500">Loading...</Text>
      </Flex>
    );
  }

  return (
    <Flex h="100vh" bg="#08080f" align="flex-start" justify="center" overflowY="auto" py={8} px={4}>
      <Box w="full" maxW="520px">
        <Box
          bg="linear-gradient(160deg, #181e35 0%, #0f1220 100%)"
          borderWidth="1px"
          borderColor="rgba(120,60,220,0.22)"
          borderRadius="20px"
          boxShadow="0 0 0 1px rgba(120,60,220,0.10), 0 16px 48px rgba(0,0,0,0.8)"
          overflow="hidden"
        >
          <Box h="3px" bg="linear-gradient(90deg, #e50914 0%, #7c3aed 50%, #1a56db 100%)" />

          {!isAdmin ? (
            <Box p={8}>
              <VStack spacing={5} align="stretch">
                <Heading textAlign="center" fontSize="xl" fontWeight="800" letterSpacing="0.1em" textTransform="uppercase" color="#c084fc">
                  Admin Panel
                </Heading>
                <Text textAlign="center" fontSize="sm" color="rgba(255,255,255,0.45)">
                  Enter your admin access code
                </Text>
                <Input
                  type="password"
                  placeholder="Admin Code"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  {...inputStyle}
                />
                {loginError && (
                  <Text color="#e50914" fontSize="sm" textAlign="center">{loginError}</Text>
                )}
                <Button
                  onClick={handleLogin}
                  isLoading={loginLoading}
                  bg="linear-gradient(135deg, #6a35e8 0%, #a855f7 100%)"
                  color="white"
                  fontWeight="700"
                  borderRadius="12px"
                  borderWidth="0"
                  _hover={{ filter: "brightness(1.15)" }}
                >
                  Enter
                </Button>
              </VStack>
            </Box>
          ) : (
            <Box p={6}>
              <VStack spacing={6} align="stretch">

                <HStack justify="space-between" align="center">
                  <Heading fontSize="lg" fontWeight="800" letterSpacing="0.1em" textTransform="uppercase" color="#c084fc">
                    Admin Panel
                  </Heading>
                  <Badge
                    bg={passcodes.length >= MAX_PASSCODES ? "rgba(229,9,20,0.15)" : "rgba(120,60,220,0.15)"}
                    color={passcodes.length >= MAX_PASSCODES ? "#e50914" : "#c084fc"}
                    borderRadius="full"
                    px={3}
                    py={1}
                    fontSize="xs"
                    fontWeight="700"
                    letterSpacing="0.06em"
                  >
                    {passcodes.length} / {MAX_PASSCODES} codes
                  </Badge>
                </HStack>

                {/* ── Create new passcode ── */}
                <Box
                  bg="rgba(255,255,255,0.03)"
                  borderRadius="14px"
                  p={4}
                  borderWidth="1px"
                  borderColor="rgba(120,60,220,0.18)"
                >
                  <Text fontSize="xs" color="rgba(255,255,255,0.4)" textTransform="uppercase" letterSpacing="0.08em" mb={3}>
                    New Passcode
                  </Text>
                  <VStack spacing={3} align="stretch">
                    <HStack spacing={2}>
                      <Input
                        flex="1"
                        placeholder="Code"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        fontFamily="monospace"
                        letterSpacing="0.12em"
                        {...inputStyle}
                        _placeholder={{ ...inputStyle._placeholder, fontFamily: "inherit", letterSpacing: "normal" }}
                      />
                      <Button
                        onClick={() => setNewCode(generateCode())}
                        bg="rgba(255,185,0,0.12)"
                        color="#ffd700"
                        borderRadius="12px"
                        borderWidth="1px"
                        borderColor="rgba(255,185,0,0.3)"
                        fontWeight="700"
                        fontSize="sm"
                        flexShrink={0}
                        _hover={{ bg: "rgba(255,185,0,0.22)" }}
                      >
                        Generate
                      </Button>
                    </HStack>
                    <Input
                      type="datetime-local"
                      placeholder="Expiry (optional)"
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                      {...inputStyle}
                      sx={{ colorScheme: "dark" }}
                    />
                    <Button
                      onClick={handleAdd}
                      isLoading={addLoading}
                      isDisabled={!newCode.trim() || passcodes.length >= MAX_PASSCODES}
                      bg="linear-gradient(90deg, #e50914 0%, #1a56db 100%)"
                      color="white"
                      fontWeight="700"
                      borderRadius="12px"
                      borderWidth="0"
                      _hover={{ filter: "brightness(1.15)" }}
                      _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                    >
                      Add Passcode
                    </Button>
                  </VStack>
                </Box>

                {/* ── Passcode list ── */}
                <Box>
                  <Text fontSize="xs" color="rgba(255,255,255,0.4)" textTransform="uppercase" letterSpacing="0.08em" mb={3}>
                    Active Passcodes
                  </Text>

                  {listLoading ? (
                    <Text fontSize="sm" color="rgba(255,255,255,0.3)" textAlign="center" py={4}>Loading...</Text>
                  ) : passcodes.length === 0 ? (
                    <Box
                      bg="rgba(255,255,255,0.02)"
                      borderRadius="12px"
                      p={4}
                      borderWidth="1px"
                      borderColor="rgba(255,255,255,0.06)"
                      textAlign="center"
                    >
                      <Text fontSize="sm" color="rgba(255,255,255,0.3)">
                        No passcodes yet. Generate one above.
                      </Text>
                    </Box>
                  ) : (
                    <VStack spacing={2} align="stretch">
                      {passcodes.map((p) => {
                        const expired = isExpired(p.expiresAt);
                        return (
                          <Box
                            key={p.id}
                            bg="rgba(255,255,255,0.03)"
                            borderRadius="12px"
                            px={4}
                            py={3}
                            borderWidth="1px"
                            borderColor={expired ? "rgba(229,9,20,0.2)" : "rgba(120,60,220,0.15)"}
                          >
                            <HStack justify="space-between" align="center">
                              <HStack spacing={3} flex="1" minW={0}>
                                <Text
                                  fontFamily="monospace"
                                  fontSize="md"
                                  fontWeight="700"
                                  letterSpacing="0.15em"
                                  color={expired ? "rgba(255,255,255,0.35)" : "#c084fc"}
                                  flexShrink={0}
                                >
                                  {p.code}
                                </Text>
                                <VStack spacing={0} align="flex-start" minW={0}>
                                  <Badge
                                    fontSize="2xs"
                                    px={2}
                                    py={0.5}
                                    borderRadius="full"
                                    bg={expired ? "rgba(229,9,20,0.15)" : "rgba(35,215,198,0.12)"}
                                    color={expired ? "#e50914" : "#23d7c6"}
                                    fontWeight="700"
                                    letterSpacing="0.06em"
                                  >
                                    {expired ? "EXPIRED" : "ACTIVE"}
                                  </Badge>
                                  {p.expiresAt ? (
                                    <Text fontSize="2xs" color="rgba(255,255,255,0.3)" noOfLines={1}>
                                      Expires {formatExpiry(p.expiresAt)}
                                    </Text>
                                  ) : (
                                    <Text fontSize="2xs" color="rgba(255,255,255,0.25)">Never expires</Text>
                                  )}
                                </VStack>
                              </HStack>
                              <HStack spacing={1} flexShrink={0}>
                                {!expired && (
                                  <Button
                                    size="xs"
                                    onClick={() => handleCopy(p.code)}
                                    bg="rgba(120,60,220,0.15)"
                                    color="#c084fc"
                                    borderRadius="8px"
                                    borderWidth="1px"
                                    borderColor="rgba(120,60,220,0.25)"
                                    fontWeight="600"
                                    _hover={{ bg: "rgba(120,60,220,0.3)" }}
                                  >
                                    Copy
                                  </Button>
                                )}
                                <Button
                                  size="xs"
                                  onClick={() => handleDelete(p.id)}
                                  bg="rgba(229,9,20,0.1)"
                                  color="#e50914"
                                  borderRadius="8px"
                                  borderWidth="1px"
                                  borderColor="rgba(229,9,20,0.2)"
                                  fontWeight="700"
                                  _hover={{ bg: "rgba(229,9,20,0.25)" }}
                                >
                                  ×
                                </Button>
                              </HStack>
                            </HStack>
                          </Box>
                        );
                      })}
                    </VStack>
                  )}
                </Box>

                {/* ── Cookie Pool ── */}
                <Box
                  bg="rgba(255,255,255,0.03)"
                  borderRadius="14px"
                  borderWidth="1px"
                  borderColor="rgba(255,255,255,0.08)"
                  p={4}
                >
                  <HStack justify="space-between" align="center">
                    <Text fontSize="xs" color="rgba(255,255,255,0.4)" textTransform="uppercase" letterSpacing="0.08em">
                      Cookie Pool (Database)
                    </Text>
                    <Button
                      size="xs"
                      onClick={fetchCookieCount}
                      bg="rgba(0,180,100,0.12)"
                      color="#4ade80"
                      borderRadius="8px"
                      borderWidth="1px"
                      borderColor="rgba(0,180,100,0.2)"
                      fontWeight="600"
                      _hover={{ bg: "rgba(0,180,100,0.25)" }}
                    >
                      Refresh
                    </Button>
                  </HStack>
                  <HStack mt={3} spacing={3}>
                    <Box
                      bg="rgba(0,180,100,0.08)"
                      borderRadius="10px"
                      borderWidth="1px"
                      borderColor="rgba(0,180,100,0.18)"
                      px={4}
                      py={3}
                      flex={1}
                      textAlign="center"
                    >
                      <Text fontSize="2xl" fontWeight="800" color="#4ade80" data-testid="text-cookie-count">
                        {cookieCount === null ? "..." : cookieCount}
                      </Text>
                      <Text fontSize="xs" color="rgba(255,255,255,0.4)" mt={1}>
                        valid cookies stored
                      </Text>
                    </Box>
                    <Text fontSize="xs" color="rgba(255,255,255,0.3)" flex={2}>
                      Auto-saved from live checks and find-account scans. Stored in PostgreSQL — survives all deployments.
                    </Text>
                  </HStack>
                </Box>

                {/* ── Abuse Log ── */}
                <Box>
                  <HStack justify="space-between" align="center" mb={3}>
                    <Text fontSize="xs" color="rgba(255,255,255,0.4)" textTransform="uppercase" letterSpacing="0.08em">
                      Generate Account — Abuse Log
                    </Text>
                    <HStack spacing={2}>
                      <Button
                        size="xs"
                        onClick={fetchAbuseLog}
                        isLoading={abuseLoading}
                        bg="rgba(120,60,220,0.15)"
                        color="#c084fc"
                        borderRadius="8px"
                        borderWidth="1px"
                        borderColor="rgba(120,60,220,0.25)"
                        fontWeight="600"
                        _hover={{ bg: "rgba(120,60,220,0.3)" }}
                      >
                        Refresh
                      </Button>
                      <Button
                        size="xs"
                        onClick={handleClearLog}
                        isLoading={clearingLog}
                        isDisabled={abuseLog.length === 0}
                        bg="rgba(229,9,20,0.1)"
                        color="#e50914"
                        borderRadius="8px"
                        borderWidth="1px"
                        borderColor="rgba(229,9,20,0.2)"
                        fontWeight="700"
                        _hover={{ bg: "rgba(229,9,20,0.25)" }}
                        _disabled={{ opacity: 0.35, cursor: "not-allowed" }}
                      >
                        Clear
                      </Button>
                    </HStack>
                  </HStack>

                  {abuseLoading ? (
                    <Text fontSize="sm" color="rgba(255,255,255,0.3)" textAlign="center" py={4}>Loading...</Text>
                  ) : abuseLog.length === 0 ? (
                    <Box
                      bg="rgba(255,255,255,0.02)"
                      borderRadius="12px"
                      p={4}
                      borderWidth="1px"
                      borderColor="rgba(255,255,255,0.06)"
                      textAlign="center"
                    >
                      <Text fontSize="sm" color="rgba(255,255,255,0.3)">No attempts recorded yet.</Text>
                    </Box>
                  ) : (
                    <VStack spacing={2} align="stretch" maxH="360px" overflowY="auto"
                      css={{ scrollbarWidth: "thin", scrollbarColor: "rgba(120,60,220,0.3) transparent" }}
                    >
                      {abuseLog.map((entry, i) => (
                        <Box
                          key={i}
                          bg="rgba(255,255,255,0.03)"
                          borderRadius="12px"
                          px={4}
                          py={3}
                          borderWidth="1px"
                          borderColor={entry.allowed ? "rgba(35,215,198,0.15)" : "rgba(229,9,20,0.25)"}
                        >
                          <HStack justify="space-between" align="flex-start" spacing={3}>
                            <VStack spacing={0.5} align="flex-start" flex="1" minW={0}>
                              <HStack spacing={2} flexWrap="wrap">
                                <Text fontFamily="monospace" fontSize="sm" fontWeight="700" color="white">
                                  {entry.ip}
                                </Text>
                                <Badge
                                  fontSize="2xs"
                                  px={2}
                                  py={0.5}
                                  borderRadius="full"
                                  bg={entry.allowed ? "rgba(35,215,198,0.12)" : "rgba(229,9,20,0.15)"}
                                  color={entry.allowed ? "#23d7c6" : "#e50914"}
                                  fontWeight="700"
                                  letterSpacing="0.06em"
                                >
                                  {entry.allowed ? "ALLOWED" : "BLOCKED"}
                                </Badge>
                                <Badge
                                  fontSize="2xs"
                                  px={2}
                                  py={0.5}
                                  borderRadius="full"
                                  bg="rgba(255,185,0,0.1)"
                                  color="#ffd700"
                                  fontWeight="700"
                                >
                                  {entry.dailyCount}/3 uses
                                </Badge>
                              </HStack>
                              <Text fontSize="2xs" color="rgba(255,255,255,0.3)" noOfLines={1}>
                                {new Date(entry.timestamp).toLocaleString()}
                              </Text>
                              <Text fontSize="2xs" color="rgba(255,255,255,0.2)" noOfLines={1} title={entry.userAgent}>
                                {entry.userAgent.slice(0, 72)}{entry.userAgent.length > 72 ? "…" : ""}
                              </Text>
                            </VStack>
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </Box>

              </VStack>
            </Box>
          )}
        </Box>
      </Box>
    </Flex>
  );
}
