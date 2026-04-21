import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { Link } from "wouter";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {
  const itemStyle = {
    h: "64px",
    w: "full",
    borderRadius: "20px",
    justifyContent: "flex-start",
    px: 6,
    fontSize: "17px",
    fontWeight: "700",
    color: "white",
    bg: "rgba(255,255,255,0.04)",
    borderWidth: "1px",
    borderColor: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
    _hover: {
      bg: "rgba(255,255,255,0.07)",
      borderColor: "rgba(124,108,255,0.40)",
      transform: "translateY(-1px)",
    },
    _active: {
      bg: "rgba(255,255,255,0.09)",
      transform: "scale(0.99)",
    },
  };

  // ✅ FINAL WORKING CONNECT TV
  const handleConnectTV = async () => {
    const win = window.open("about:blank", "_blank");

    if (!win) {
      alert("Popup blocked");
      return;
    }

    // loading screen
    win.document.write(`
      <body style="
        background:#0d0f18;
        color:white;
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
        font-family:sans-serif;
      ">
        <h2>Preparing your TV session...</h2>
      </body>
    `);

    try {
      const res = await fetch("/api/get-tv-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          passcode: "10000001"
        })
      });

      const data = await res.json();

      // ❌ no account
      if (!data.ok || !data.tvLink) {
        win.document.body.innerHTML = "<h2>No account available</h2>";
        return;
      }

      // ✅ ONLY REDIRECT (no tv8, no extra logic)
      win.location.href = data.tvLink;

    } catch (err) {
      win.document.body.innerHTML = "<h2>Error loading account</h2>";
    }
  };

  return (
    <>
      <Box
        position="fixed"
        inset="0"
        bg="rgba(0,0,0,0.52)"
        backdropFilter="blur(4px)"
        zIndex="1390"
        onClick={onClose}
      />

      <Box
        position="fixed"
        top="14px"
        right="14px"
        bottom="14px"
        w={{ base: "78vw", sm: "390px" }}
        maxW="390px"
        bg="linear-gradient(180deg, rgba(15,22,48,0.96) 0%, rgba(11,18,42,0.98) 100%)"
        border="1px solid rgba(255,255,255,0.08)"
        borderRadius="28px"
        boxShadow="0 20px 60px rgba(0,0,0,0.45)"
        zIndex="1400"
        overflow="hidden"
      >
        <Box px={6} pt={6} pb={5} borderBottom="1px solid rgba(255,255,255,0.06)">
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text color="#7c6cff" fontWeight="900" fontSize="15px">
                NAVIGATION
              </Text>
              <Text color="rgba(255,255,255,0.45)" fontSize="12px">
                Quick access
              </Text>
            </VStack>

            <Button onClick={onClose} minW="48px" h="48px">×</Button>
          </HStack>
        </Box>

        <VStack spacing={5} align="stretch" px={6} pt={6}>
          <Link href="/">
            <Button {...itemStyle} onClick={onClose}>
              ⌂ Cookie Checker
            </Button>
          </Link>

          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onPremiumClick?.();
            }}
          >
            ★ Premium Account
          </Button>

          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onRandomClick?.();
            }}
          >
            ⟳ Random Account
          </Button>
        </VStack>

        <Box px={6} pt={8}>
          <Box h="1px" bg="rgba(124,108,255,0.35)" />
        </Box>

        <Box px={6} pt={5}>
          <Text fontSize="12px" textAlign="center">
            FAST ACTIONS
          </Text>
        </Box>

        {/* ✅ CONNECT TV BUTTON ENABLED */}
        <VStack spacing={4} align="stretch" px={6} pt={4}>
          <Button
            h="52px"
            borderRadius="18px"
            bg="linear-gradient(90deg, #7c3aed, #a855f7)"
            color="white"
            fontSize="15px"
            fontWeight="700"
            _hover={{ filter: "brightness(1.1)" }}
            onClick={handleConnectTV}
          >
            📺 Connect TV
          </Button>
        </VStack>
      </Box>
    </>
  );
}
