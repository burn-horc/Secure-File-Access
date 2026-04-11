
import { Box, Text, VStack, Input, Button, Flex } from "@chakra-ui/react";
import { useState } from "react";

export default function TVSubmit() {
  const [code, setCode] = useState("");

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setCode(value);
  };

  const handleSubmit = async () => {
    const res = await fetch("/api/tv/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Connected to TV!");
    } else {
      alert(data.error);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="#0d0f18">
      <Box p={8} borderRadius="20px" bg="#111" textAlign="center">
        <VStack spacing={4}>
          <Text color="green.400">Hi!</Text>
          <Text fontSize="2xl" color="white">
            Match the code on your TV
          </Text>

          <Input
            value={code}
            onChange={handleChange}
            placeholder="12345678"
            textAlign="center"
            color="white"
          />

          <Button onClick={handleSubmit} colorScheme="purple" w="full">
            Continue
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
}
