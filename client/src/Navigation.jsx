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
        boxShadow="0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(111,99,255,0.08) inset"
        zIndex="1400"
        overflow="hidden"
      >
        <Box
          px={6}
          pt={6}
          pb={5}
          borderBottom="1px solid rgba(255,255,255,0.06)"
          bg="linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)"
        >
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Text
                color="#7c6cff"
                fontWeight="900"
                fontSize="15px"
                letterSpacing="0.14em"
              >
                NAVIGATION
              </Text>
              <Text color="rgba(255,255,255,0.45)" fontSize="12px">
                Quick access
              </Text>
            </VStack>

            <Button
              onClick={onClose}
              minW="48px"
              h="48px"
              p="0"
              borderRadius="16px"
              color="white"
              bg="rgba(255,255,255,0.04)"
              border="1px solid rgba(255,255,255,0.10)"
              fontSize="24px"
              _hover={{ bg: "rgba(255,255,255,0.07)" }}
              _active={{ transform: "scale(0.97)" }}
            >
              ×
            </Button>
          </HStack>
        </Box>

        <VStack spacing={5} align="stretch" px={6} pt={6}>
          <Link href="/">
            <Button
              {...itemStyle}
              onClick={onClose}
              bg="linear-gradient(135deg, rgba(111,99,255,0.22) 0%, rgba(111,99,255,0.12) 100%)"
              borderColor="rgba(111,99,255,0.50)"
              boxShadow="0 0 0 1px rgba(111,99,255,0.12) inset, 0 10px 24px rgba(0,0,0,0.22)"
            >
              <HStack spacing={5}>
                <Text fontSize="22px">⌂</Text>
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
            <HStack spacing={5}>
              <Text fontSize="22px">★</Text>
              <Text>Premium Account</Text>
            </HStack>
          </Button>

          <Button
            {...itemStyle}
            onClick={() => {
              onClose?.();
              onRandomClick?.();
            }}
            borderColor="rgba(80,160,255,0.40)"
            bg="linear-gradient(135deg, rgba(80,160,255,0.16) 0%, rgba(80,160,255,0.08) 100%)"
          >
            <HStack spacing={5}>
              <Text fontSize="22px">⟳</Text>
              <Text>Random Account</Text>
            </HStack>
          </Button>
        </VStack>

        <Box px={6} pt={8}>
          <Box
            h="1px"
            bg="linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(124,108,255,0.35) 50%, rgba(255,255,255,0) 100%)"
          />
        </Box>

        <Box px={6} pt={5}>
          <Text
            color="rgba(255,255,255,0.38)"
            fontSize="12px"
            textAlign="center"
            letterSpacing="0.12em"
          >
            FAST ACTIONS
          </Text>
        </Box>

        <VStack spacing={4} align="stretch" px={6} pt={4}>
  <Button
    h="52px"
    borderRadius="18px"
    color="rgba(255,255,255,0.55)"
    bg="rgba(255,255,255,0.02)"
    border="1px dashed rgba(255,255,255,0.10)"
    fontSize="15px"
    fontWeight="700"
    _hover={{ bg: "rgba(255,255,255,0.04)" }}
    onClick={() => {
  onClose?.();
  handleConnectTV();
}}
  >
    📺 Connect TV
  </Button>
</VStack>
      </Box>
    </>
  );
}
