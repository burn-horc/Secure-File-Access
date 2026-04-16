import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { Link } from "wouter";

export default function Navigation({ onClose, onPremiumClick, onRandomClick }) {
  const itemStyle = {
    h: "72px",
    w: "full",
    borderRadius: "24px",
    justifyContent: "flex-start",
    px: 8,
    fontSize: "18px",
    fontWeight: "700",
    color: "white",
    bg: "rgba(255,255,255,0.03)",
    borderWidth: "1px",
    borderColor: "rgba(255,255,255,0.10)",
    transition: "all 0.2s ease",
    _hover: {
      bg: "rgba(255,255,255,0.06)",
      borderColor: "rgba(124,108,255,0.35)",
    },
    _active: {
      bg: "rgba(255,255,255,0.08)",
    },
  };

  return (
    <>
      <Box
        position="fixed"
        inset="0"
        bg="rgba(0,0,0,0.45)"
        backdropFilter="blur(2px)"
        zIndex="999"
        onClick={onClose}
      />

      <Box
        position="fixed"
        top="0"
        right="0"
        h="100vh"
        w={{ base: "82vw", sm: "420px" }}
        bg="linear-gradient(180deg, #10162a 0%, #0d1430 100%)"
        borderLeft="1px solid rgba(255,255,255,0.08)"
        boxShadow="-20px 0 40px rgba(0,0,0,0.45)"
        zIndex="1000"
        overflow="hidden"
      >
        <Box
          px={8}
          py={7}
          borderBottom="1px solid rgba(255,255,255,0.06)"
        >
          <HStack justify="space-between" align="center">
            <Text
              color="#6f63ff"
              fontWeight="800"
              fontSize="16px"
              letterSpacing="0.12em"
            >
              NAVIGATION
            </Text>

            <Button
              onClick={onClose}
              variant="ghost"
              minW="56px"
              h="56px"
              borderRadius="18px"
              color="white"
              bg="rgba(255,255,255,0.03)"
              border="1px solid rgba(255,255,255,0.10)"
              fontSize="28px"
              _hover={{ bg: "rgba(255,255,255,0.06)" }}
            >
              ×
            </Button>
          </HStack>
        </Box>

        <VStack spacing={6} align="stretch" px={8} pt={10}>
          {/* HOME */}
          <Link href="/">
            <Button
              {...itemStyle}
              onClick={onClose}
              bg="rgba(111,99,255,0.16)"
              borderColor="rgba(111,99,255,0.65)"
              boxShadow="0 0 0 1px rgba(111,99,255,0.15) inset"
            >
              <HStack spacing={6}>
                <Text fontSize="24px">⌂</Text>
                <Text>Cookie Checker</Text>
              </HStack>
            </Button>
          </Link>

          {/* ⭐ PREMIUM */}
          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onPremiumClick?.();
            }}
            bg="rgba(124,108,255,0.18)"
            borderColor="rgba(124,108,255,0.65)"
            boxShadow="0 0 0 1px rgba(124,108,255,0.25) inset"
            _hover={{
              bg: "rgba(124,108,255,0.28)",
              borderColor: "rgba(124,108,255,0.9)",
              transform: "scale(1.02)",
            }}
          >
            <HStack spacing={6}>
              <Text fontSize="22px">★</Text>
              <Text>Premium Account</Text>
            </HStack>
          </Button>

          {/* 🔵 RANDOM */}
          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onRandomClick?.();
            }}
            bg="rgba(80,160,255,0.15)"
            borderColor="rgba(80,160,255,0.6)"
            boxShadow="0 0 0 1px rgba(80,160,255,0.25) inset"
            _hover={{
              bg: "rgba(80,160,255,0.25)",
              borderColor: "rgba(80,160,255,0.9)",
              transform: "scale(1.02)",
            }}
          >
            <HStack spacing={6}>
              <Text fontSize="22px">⟳</Text>
              <Text>Random Account</Text>
            </HStack>
          </Button>
        </VStack>
      </Box>
    </>
  );
}
