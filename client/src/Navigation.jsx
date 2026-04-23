import { Box, Button, HStack, Text, VStack, Input } from "@chakra-ui/react";
import { Link } from "wouter";
import { useState } from "react";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {

  const [showModal, setShowModal] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

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
    _hover: {
      bg: "rgba(124,108,255,0.08)",
      borderColor: "#7c6cff",
      boxShadow: "0 0 18px rgba(124,108,255,0.6)",
      transform: "translateY(-2px)",
    },
    _active: {
      transform: "scale(0.97)",
      boxShadow: "0 0 10px rgba(124,108,255,0.8)"
    }
  };

  const handleGenerateRandom = async () => {
    if (!passcode) return;

    setLoading(true);

    try {
      const res = await fetch("/api/generate-random-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ passcode })
      });

      const data = await res.json();

      if (!data.ok) {
        setGeneratedCode("❌ " + data.error);
        return;
      }

      await navigator.clipboard.writeText(data.code);

      setGeneratedCode(data.code);

    } catch (err) {
      setGeneratedCode("❌ Something went wrong");
    } finally {
      setLoading(false);
    }
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

        {/* MAIN */}
        <VStack spacing={4} px={6} pt={6}>

          <Link href="/">
            <Button {...itemStyle}>⌂ Cookie Checker</Button>
          </Link>

          <Button {...itemStyle} onClick={onPremiumClick}>
            ★ Premium Account
          </Button>

          <Button {...itemStyle} onClick={onRandomClick}>
            ⟳ Random Account
          </Button>

          <Button
            {...itemStyle}
            onClick={() => setShowModal(true)}
            borderColor="rgba(124,255,180,0.4)"
            bg="linear-gradient(135deg, rgba(124,255,180,0.16), rgba(124,255,180,0.08))"
          >
            ⚡ Generate Code
          </Button>

        </VStack>

      </Box>

      {/* 🔥 MODAL */}
      {showModal && (
        <Box
          position="fixed"
          inset="0"
          bg="rgba(0,0,0,0.7)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex="2000"
        >
          <Box
            bg="#0a0f24"
            border="1px solid #7c6cff"
            borderRadius="20px"
            p={6}
            w="90%"
            maxW="320px"
          >
            <VStack spacing={4}>

              <Text color="#7c6cff">Enter Passcode</Text>

              <Input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />

              <Button
                w="full"
                onClick={handleGenerateRandom}
                isLoading={loading}
              >
                Generate
              </Button>

              {/* 🔥 RESULT */}
              {generatedCode && (
                <Box
                  w="full"
                  textAlign="center"
                  p={3}
                  borderRadius="10px"
                  bg="rgba(124,108,255,0.1)"
                  border="1px solid #7c6cff"
                >
                  <Text fontSize="14px">
                    {generatedCode.startsWith("❌")
                      ? generatedCode
                      : `Copied: ${generatedCode}`}
                  </Text>
                </Box>
              )}

              <Button w="full" onClick={() => setShowModal(false)}>
                Close
              </Button>

            </VStack>
          </Box>
        </Box>
      )}
    </>
  );
}
