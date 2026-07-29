import {
  Box,
  Button,
  Divider,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import { supabase } from "./supabaseClient";

export default function LoginPage() {
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="#090909"
      bgGradient="radial(circle at top, #1b1b1b 0%, #090909 65%)"
      px={6}
    >
      <Box
        w="100%"
        maxW="440px"
        p={10}
        bg="#121212"
        border="1px solid rgba(255,255,255,0.06)"
        borderRadius="24px"
        boxShadow="0 35px 80px rgba(0,0,0,.75)"
      >
        <VStack spacing={6} align="stretch">
          <Text
            color="red.500"
            fontSize="sm"
            fontWeight="700"
            letterSpacing="0.25em"
            textTransform="uppercase"
            textAlign="center"
          >
            Secure Portal
          </Text>

          <Heading
            color="white"
            fontSize="42px"
            fontWeight="800"
            textAlign="center"
            lineHeight="1.1"
          >
            Welcome
          </Heading>

          <Text
            color="gray.400"
            textAlign="center"
            fontSize="15px"
            lineHeight="1.7"
          >
            Sign in with your Google account to securely access your dashboard.
          </Text>

          <Button
            onClick={signIn}
            h="58px"
            w="100%"
            bg="#E50914"
            color="white"
            fontWeight="700"
            fontSize="16px"
            borderRadius="14px"
            _hover={{
              bg: "#F40612",
              transform: "translateY(-2px)",
              boxShadow: "0 10px 30px rgba(229,9,20,.35)",
            }}
            _active={{
              transform: "scale(.98)",
            }}
            transition="all .2s"
          >
            Continue with Google
          </Button>

          <Divider borderColor="whiteAlpha.100" />

          <Text
            textAlign="center"
            color="gray.500"
            fontSize="13px"
          >
            Protected by Google Authentication
          </Text>

          <Text
            textAlign="center"
            color="gray.600"
            fontSize="11px"
          >
            © 2026 • All rights reserved
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
