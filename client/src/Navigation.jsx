import { Box, Button, HStack, Text, VStack, Input } from "@chakra-ui/react";
import { Link } from "wouter";
import { useState } from "react";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {

  const [showModal, setShowModal] = useState(false);
  const [passcode, setPasscode] = useState("");

  const [showResult, setShowResult] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false); // 🔥 NEW

  const itemStyle = {
    h: "64px",
    w: "full",
    borderRadius: "20px",
    justifyContent: "flex-start",
    px: 6,
    fontSize: "16px",
    fontWeight: "700",
    color: "white",
    bg: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(124,108,255,0.15)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 0 12px rgba(124,108,255,0.12)",
  };

  const handleSubmitPasscode = async () => {
    if (!passcode) return;

    setErrorMsg("");

    try {
      const res = await fetch("/api/generate-random-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
      });

      const data = await res.json();

      if (!data.ok) {
        setErrorMsg(data.error || "Something went wrong");
        return;
      }

      // auto copy (still keep)
      navigator.clipboard.writeText(data.code);

      setGeneratedCode(data.code);
      setShowModal(false);
      setShowResult(true);
      setPasscode("");
      setCopied(true);

    } catch {
      setErrorMsg("Something went wrong");
    }
  };

  // 🔥 COPY BUTTON HANDLER
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);

    setTimeout(() => setCopied(false), 1500); // reset text
  };

  return (
    <>
      {/* BACKDROP */}
      <Box
        position="fixed"
        inset="0"
        bg="rgba(0,0,0,0.6)"
        backdropFilter="blur(6px)"
        zIndex="1390"
        onClick={onClose}
      />

      {/* PANEL */}
      <Box
        position="fixed"
        top="14px"
        right="14px"
        bottom="14px"
        w={{ base: "78vw", sm: "360px" }}
        maxW="360px"
        display="flex"
        flexDirection="column"
        bg="linear-gradient(180deg, rgba(10,14,30,0.95), rgba(5,8,20,0.98))"
        border="1px solid rgba(124,108,255,0.25)"
        borderRadius="28px"
        boxShadow="0 0 30px rgba(124,108,255,0.25)"
        zIndex="1400"
      >

        {/* HEADER */}
        <Box px={6} pt={6} pb={5} borderBottom="1px solid rgba(124,108,255,0.2)">
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text color="#7c6cff" fontWeight="900" fontSize="14px">
                NAVIGATION
              </Text>
              <Text color="rgba(255,255,255,0.4)" fontSize="12px">
                Control panel
              </Text>
            </VStack>
            <Button onClick={onClose}>×</Button>
          </HStack>
        </Box>

        {/* CONTENT */}
        <Box flex="1" display="flex" flexDirection="column" justifyContent="space-between">

          {/* TOP */}
          <VStack spacing={4} align="stretch" px={6} pt={6}>
            <Link href="/">
              <Button {...itemStyle} onClick={onClose}>
                ⌂ Cookie Checker
              </Button>
            </Link>

            <Button {...itemStyle} onClick={() => {
              onClose?.();
              onPremiumClick?.();
            }}>
              ★ Premium Account
            </Button>

            <Button {...itemStyle} onClick={() => {
              onClose?.();
              onRandomClick?.();
            }}>
              ⟳ Random Account
            </Button>
          </VStack>

          {/* BOTTOM */}
          <Box px={6} pb={6}>
            <Button
              {...itemStyle}
              w="full"
              onClick={() => setShowModal(true)}
              borderColor="rgba(124,255,180,0.4)"
              bg="linear-gradient(135deg, rgba(124,255,180,0.16), rgba(124,255,180,0.08))"
            >
              ⚡ Generate Code
            </Button>

            <Box mt={6} h="1px" bg="linear-gradient(90deg, transparent, #7c6cff, transparent)" />

            <Text
              mt={4}
              textAlign="center"
              fontSize="11px"
              letterSpacing="0.2em"
              color="#7c6cff"
            >
              SYSTEM READY
            </Text>
          </Box>
        </Box>
      </Box>

      {/* PASSCODE MODAL */}
      {showModal && (
        <Box position="fixed" inset="0" bg="rgba(0,0,0,0.7)" display="flex" alignItems="center" justifyContent="center" zIndex="2000">
          <Box bg="#050814" border="1px solid #7c6cff" p={6} borderRadius="20px">
            <VStack spacing={4}>
              <Text color="#7c6cff">Enter Passcode</Text>

              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                color="white"
              />

              <Button w="full" onClick={handleSubmitPasscode}>
                Generate
              </Button>

              {errorMsg && <Text color="red">❌ {errorMsg}</Text>}

              <Button w="full" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </VStack>
          </Box>
        </Box>
      )}

      {/* RESULT MODAL */}
      {showResult && (
        <Box position="fixed" inset="0" bg="rgba(0,0,0,0.7)" display="flex" alignItems="center" justifyContent="center" zIndex="2100">
          <Box bg="#050814" border="1px solid #7c6cff" p={6} borderRadius="20px">
            <VStack spacing={4}>
              <Text color="#7c6cff">⚡ Code Ready</Text>

              <Box
                w="full"
                p={3}
                borderRadius="12px"
                bg="rgba(255,255,255,0.05)"
                textAlign="center"
                fontWeight="bold"
              >
                {generatedCode}
              </Box>

              {/* 🔥 COPY BUTTON */}
              <Button
                w="full"
                onClick={handleCopy}
                bg="#7c6cff"
                color="white"
              >
                {copied ? "✔ Copied" : "Copy Code"}
              </Button>

              <Button w="full" onClick={() => setShowResult(false)}>
                Close
              </Button>
            </VStack>
          </Box>
        </Box>
      )}
    </>
  );
}
