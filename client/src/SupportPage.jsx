import React from "react";
import {
  Box,
  Button,
  Container,
  Divider,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useLocation } from "wouter";

export default function SupportPage() {
  const [, setLocation] = useLocation();

  return (
    <Box minH="100vh" bg="#0d0f18" color="white" py={8} px={4}>
      <Container maxW="md">
        <VStack
          spacing={5}
          align="stretch"
          borderWidth="1px"
          borderColor="rgba(139,92,246,0.22)"
          borderRadius="24px"
          bg="linear-gradient(160deg, #181e35 0%, #0f1220 100%)"
          boxShadow="0 8px 32px rgba(0,0,0,0.65)"
          p={6}
        >
          <VStack spacing={2} textAlign="center">
            <Text
              fontSize="xl"
              fontWeight="800"
              letterSpacing="0.1em"
              textTransform="uppercase"
              color="#8b5cf6"
            >
              Support
            </Text>
            <Text fontSize="sm" color="rgba(255,255,255,0.65)">
              Help, setup information, and contact options.
            </Text>
          </VStack>

          <Divider borderColor="rgba(255,255,255,0.08)" />

          <Box>
            <Text fontSize="sm" fontWeight="700" mb={1}>
              Help Guide
            </Text>
            <Text fontSize="sm" color="rgba(255,255,255,0.72)">
              Check the guide first for setup steps and common questions.
            </Text>
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="700" mb={1}>
              Contact
            </Text>
            <Text fontSize="sm" color="rgba(255,255,255,0.72)">
              For general support, use your preferred contact option below.
            </Text>
          </Box>

          <VStack spacing={3} pt={1}>
            <Button
              as="a"
              href="mailto:you@example.com"
              w="full"
              borderRadius="12px"
              bg="linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)"
              color="white"
              _hover={{ filter: "brightness(1.08)" }}
            >
              Email Support
            </Button>

            <Button
              w="full"
              variant="outline"
              borderColor="rgba(255,255,255,0.16)"
              color="rgba(255,255,255,0.86)"
              borderRadius="12px"
              _hover={{ bg: "rgba(255,255,255,0.04)" }}
              onClick={() => setLocation("/")}
            >
              Back to Home
            </Button>
          </VStack>

          <Text
            textAlign="center"
            fontSize="12px"
            color="rgba(255,255,255,0.38)"
            pt={1}
          >
            © 2026 SATISACROH. All Rights Reserved.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
