import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { Link } from "wouter";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {
  const itemStyle = {
    w: "full",
    h: "60px",
    borderRadius: "18px",
    justifyContent: "flex-start",
    px: 5,
    fontSize: "15px",
    fontWeight: "700",
    color: "white",
    bg: "rgba(255,255,255,0.05)",
    borderWidth: "1px",
    borderColor: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    _hover: {
      bg: "rgba(255,255,255,0.08)",
      borderColor: "rgba(124,108,255,0.5)",
    },
    _active: {
      transform: "scale(0.98)"
    }
  };

  const handleConnectTV = async () => {
    const win = window.open("about:blank", "_blank");

    if (!win) {
      alert("Popup blocked");
      return;
    }

    try {
      win.document.write(`
        <html>
          <body style="
            background:#0d0f18;
            color:white;
            display:flex;
            justify-content:center;
            align-items:center;
            height:100vh;
            font-family:sans-serif;
          ">
            <h2>Connecting...</h2>
          </body>
        </html>
      `);

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

      if (!data.ok || !data.tvLink) {
        win.document.body.innerHTML = `
          <pre style="color:white">${JSON.stringify(data, null, 2)}</pre>
        `;
        return;
      }

      win.location.href = data.tvLink;

    } catch (err) {
      win.document.body.innerHTML = "<h2>Error loading</h2>";
    }
  };

  return (
    <>
      {/* BACKDROP */}
      <Box
        position="fixed"
        inset="0"
        bg="rgba(0,0,0,0.5)"
        backdropFilter="blur(4px)"
        zIndex="1390"
        onClick={onClose}
      />

      {/* BOTTOM PANEL */}
      <Box
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        bg="linear-gradient(180deg, rgba(15,22,48,0.95) 0%, rgba(10,15,35,0.98) 100%)"
        borderTop="1px solid rgba(255,255,255,0.1)"
        borderTopRadius="28px"
        boxShadow="0 -20px 60px rgba(0,0,0,0.6)"
        zIndex="1400"
        px={5}
        pt={4}
        pb={6}
        animation="slideUp 0.25s ease-out"
      >

        {/* DRAG HANDLE */}
        <Box
          w="40px"
          h="4px"
          bg="rgba(255,255,255,0.3)"
          borderRadius="full"
          mx="auto"
          mb={4}
        />

        {/* TITLE */}
        <Text
          textAlign="center"
          fontSize="13px"
          letterSpacing="0.15em"
          color="rgba(255,255,255,0.4)"
          mb={4}
        >
          QUICK ACCESS
        </Text>

        {/* BUTTONS */}
        <VStack spacing={3}>

          <Link href="/">
            <Button {...itemStyle} onClick={onClose}>
              <HStack spacing={4}>
                <Text fontSize="20px">⌂</Text>
                <Text>Cookie Checker</Text>
              </HStack>
            </Button>
          </Link>

          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onPremiumClick?.();
            }}
          >
            <HStack spacing={4}>
              <Text fontSize="20px">★</Text>
              <Text>Premium Account</Text>
            </HStack>
          </Button>

          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onRandomClick?.();
            }}
          >
            <HStack spacing={4}>
              <Text fontSize="20px">⟳</Text>
              <Text>Random Account</Text>
            </HStack>
          </Button>

          {/* CONNECT TV */}
          <Button
            {...itemStyle}
            onClick={handleConnectTV}
          >
            <HStack spacing={4}>
              <Text fontSize="20px">📺</Text>
              <Text>Connect TV</Text>
            </HStack>
          </Button>

        </VStack>
      </Box>

      {/* ANIMATION */}
      <style>
        {`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0%);
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
}
