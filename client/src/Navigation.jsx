import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { Link } from "wouter";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {

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
        <Box
          px={6}
          pt={6}
          pb={5}
          borderBottom="1px solid rgba(124,108,255,0.2)"
        >
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
            <Button
              {...itemStyle}
              onClick={onClose}
            >
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

        </VStack>

        {/* FOOTER LINE */}
        <Box px={6} pt={8}>
          <Box
            h="1px"
            bg="linear-gradient(90deg, transparent, #7c6cff, transparent)"
          />
        </Box>

        {/* FOOTER TEXT */}
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
    </>
  );
}
