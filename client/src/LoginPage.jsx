import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  Icon,
} from "@chakra-ui/react";
import { FaShieldAlt } from "react-icons/fa";
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
      bgGradient="linear(to-br, #0f0f0f, #1a1a1a, #000)"
      px={6}
    >
      <Box
        w="100%"
        maxW="450px"
        p={10}
        textAlign="center"
        bg="rgba(255,255,255,0.05)"
        border="1px solid rgba(255,255,255,0.08)"
        backdropFilter="blur(18px)"
        borderRadius="2xl"
        boxShadow="0 25px 60px rgba(0,0,0,.55)"
      >
        <VStack spacing={7}>
          <Box
            bg="red.500"
            color="white"
            w="70px"
            h="70px"
            rounded="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="30px"
            fontWeight="bold"
          >
            N
          </Box>

          <Heading
            color="white"
            fontSize="4xl"
            fontWeight="extrabold"
          >
            Welcome 👋
          </Heading>

          <Text
            color="gray.300"
            fontSize="md"
            maxW="320px"
          >
            Sign in securely with your Google account to continue.
          </Text>

          <Button
            colorScheme="red"
            size="lg"
            width="100%"
            h="58px"
            fontSize="lg"
            fontWeight="bold"
            borderRadius="xl"
            onClick={signIn}
            _hover={{
              transform: "translateY(-2px)",
            }}
            transition="0.2s"
          >
            Continue with Google
          </Button>

          <Box
            display="flex"
            alignItems="center"
            gap={2}
            color="green.300"
          >
            <Icon as={FaShieldAlt} />
            <Text fontSize="sm">
              Secure authentication powered by Google
            </Text>
          </Box>

          <Text
            color="gray.500"
            fontSize="xs"
          >
            Your account is protected using encrypted authentication.
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
