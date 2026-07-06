import { Box, Button, Heading, VStack } from "@chakra-ui/react";
import { supabase } from "./supabase";

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
      bg="#141414"
    >
      <VStack spacing={6}>
        <Heading color="white">
          Welcome
        </Heading>

        <Button
          colorScheme="red"
          size="lg"
          onClick={signIn}
        >
          Continue with Google
        </Button>
      </VStack>
    </Box>
  );
}
