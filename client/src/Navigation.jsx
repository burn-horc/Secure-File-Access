import { Box, Button, Text, VStack } from "@chakra-ui/react";
import { Link } from "wouter";

export default function Navigation({ onClose }) {
  return (
    <Box
      position="fixed"
      top="0"
      right="0"
      h="100vh"
      w="min(82vw, 420px)"
      bg="#12172a"
      borderLeft="1px solid rgba(255,255,255,0.08)"
      zIndex="1000"
      p={6}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={8}>
        <Text color="#7c6cff" fontWeight="800" letterSpacing="0.08em">
          NAVIGATION
        </Text>
        <Button onClick={onClose} variant="ghost">
          ×
        </Button>
      </Box>

      <VStack spacing={4} align="stretch">
        <Link href="/">
          <Button h="72px" w="full" borderRadius="24px" onClick={onClose}>
            Home
          </Button>
        </Link>

        <Link href="/guide">
          <Button h="72px" w="full" borderRadius="24px" variant="outline" onClick={onClose}>
            Guide
          </Button>
        </Link>
      </VStack>
    </Box>
  );
}
