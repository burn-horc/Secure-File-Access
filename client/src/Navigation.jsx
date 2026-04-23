import { Box, Button, HStack, Text, VStack, Input, useToast } from "@chakra-ui/react";
import { Link } from "wouter";
import { useState } from "react";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {

  const [showModal, setShowModal] = useState(false);
  const [passcode, setPasscode] = useState("");
  const toast = useToast();

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

  const handleSubmitPasscode = async () => {
    if (!passcode) return;

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
        toast({
          title: "Error",
          description: data.error,
          status: "error",
          duration: 2500,
          position: "top"
        });
        return;
      }

      // ✅ copy properly
      await navigator.clipboard.writeText(data.code);

      // 🔥 NEON TOAST
      toast({
        duration: 3000,
        position: "top",
        render: () => (
          <Box
            bg="linear-gradient(135deg, #0a0f24, #050814)"
            border="1px solid #7c6cff"
            boxShadow="0 0 20px rgba(124,108,255,0.6)"
            color="white"
            px={5}
            py={4}
            borderRadius="14px"
          >
            <Text fontWeight="bold" color="#7c6cff">
              ⚡ Code Ready
            </Text>
            <Text fontSize="sm">{data.code}</Text>
          </Box>
        ),
      });

      // 🔥 AUTO USE CODE (UNCOMMENT IF YOU WANT)
      onRandomClick?.(data.code);

      setShowModal(false);
      setPasscode("");

    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong",
        status: "error",
        duration: 2500,
        position: "top"
      });
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
        bg="linear-gradient(180deg, rgba(10,14,30,0.95) 0%, rgba(5,8,20,0.98) 100%)"
        border="1px solid rgba(124,108,255,0.25)"
        borderRadius="28px"
        boxShadow="
          0 0 30px rgba(124,108,255,0.25),
          inset 0 0 20px rgba(124,108,255,0.08)
        "
        zIndex="1400"
        overflow="hidden"
      >

        {/* HEADER */}
        <Box px={6} pt={6} pb={5} borderBottom="1px solid rgba(124,108,255,0.2)">
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text
                color="#7c6cff"
                fontWeight="900"
                fontSize="14px"
                letterSpacing="0.18em"
                textShadow="0 0 10px #7c6cff"
              >
                NAVIGATION
              </Text>
              <Text color="rgba(255,255,255,0.4)" fontSize="12px">
                Control panel
              </Text>
            </VStack>

            <Button
              onClick={onClose}
              minW="44px"
              h="44px"
              borderRadius="14px"
              color="white"
              bg="rgba(255,255,255,0.05)"
              border="1px solid rgba(124,108,255,0.3)"
              fontSize="22px"
              _hover={{
                bg: "rgba(124,108,255,0.2)",
                boxShadow: "0 0 12px #7c6cff"
              }}
            >
              ×
            </Button>
          </HStack>
        </Box>

        {/* MAIN */}
        <VStack spacing={4} align="stretch" px={6} pt={6}>

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

          {/* GENERATE BUTTON */}
          <Button
            {...itemStyle}
            onClick={() => setShowModal(true)}
            borderColor="rgba(124,255,180,0.4)"
            bg="linear-gradient(135deg, rgba(124,255,180,0.16) 0%, rgba(124,255,180,0.08) 100%)"
          >
            <HStack spacing={4}>
              <Text fontSize="20px">⚡</Text>
              <Text>Generate Code</Text>
            </HStack>
          </Button>

        </VStack>

        {/* FOOTER */}
        <Box px={6} pt={8}>
          <Box h="1px" bg="linear-gradient(90deg, transparent, #7c6cff, transparent)" />
        </Box>

        <Box px={6} pt={5} pb={6}>
          <Text
            color="rgba(255,255,255,0.3)"
            fontSize="11px"
            textAlign="center"
            letterSpacing="0.15em"
          >
            SYSTEM READY
          </Text>
        </Box>

      </Box>

      {/* MODAL */}
      {showModal && (
        <Box
          position="fixed"
          inset="0"
          bg="rgba(0,0,0,0.7)"
          backdropFilter="blur(8px)"
          zIndex="2000"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Box
            bg="linear-gradient(180deg, #0a0f24, #050814)"
            border="1px solid rgba(124,108,255,0.4)"
            borderRadius="20px"
            p={6}
            w="90%"
            maxW="320px"
            boxShadow="0 0 25px rgba(124,108,255,0.4)"
          >
            <VStack spacing={4}>

              <Text color="#7c6cff" fontWeight="bold">
                Enter Passcode
              </Text>

              <Input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                bg="rgba(255,255,255,0.05)"
                border="1px solid rgba(124,108,255,0.3)"
                color="white"
              />

              <HStack w="full">
                <Button flex="1" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>

                <Button
                  flex="1"
                  bg="#7c6cff"
                  color="white"
                  onClick={handleSubmitPasscode}
                >
                  OK
                </Button>
              </HStack>

            </VStack>
          </Box>
        </Box>
      )}
    </>
  );
}
