
import { Box, Button, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useRef, useState } from "react";

export default function TVSubmit() {
  const [digits, setDigits] = useState(Array(8).fill(""));
  const refs = useRef([]);

  const handleChange = (index, value) => {
    const next = value.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = next;
    setDigits(updated);

    if (next && index < 7) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      if (digits[index]) {
        const updated = [...digits];
        updated[index] = "";
        setDigits(updated);
        return;
      }

      if (index > 0) {
        refs.current[index - 1]?.focus();
      }
    }
  };

  const code = digits.join("");

  const handleSubmit = async () => {
    if (code.length !== 8) return;

    const res = await fetch("/api/tv/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Connected!");
    } else {
      alert(data.error || "Failed");
    }
  };

  return (
    <Box minH="100vh" bg="#0b1020" color="white" px={4} py={8}>
      <Box
        maxW="820px"
        mx="auto"
        borderWidth="1px"
        borderColor="rgba(139,92,246,0.18)"
        borderRadius="28px"
        bg="linear-gradient(180deg, #10162a 0%, #0d1430 100%)"
        boxShadow="0 10px 40px rgba(0,0,0,0.45)"
        px={{ base: 4, sm: 6 }}
        py={{ base: 10, sm: 14 }}
      >
        <VStack spacing={8}>
          <Text
            textAlign="center"
            fontSize={{ base: "4xl", sm: "6xl" }}
            fontWeight="800"
            lineHeight="1.05"
          >
            Match the code on your TV
          </Text>

          <Text
            textAlign="center"
            color="rgba(255,255,255,0.58)"
            fontSize={{ base: "lg", sm: "2xl" }}
            maxW="900px"
          >
            Confirm or enter the 8-digit code below.
          </Text>

          <Box
            w="full"
            maxW="980px"
            borderWidth="1px"
            borderColor="rgba(255,255,255,0.08)"
            borderRadius="30px"
            bg="rgba(10,14,30,0.35)"
            px={{ base: 3, sm: 6 }}
            py={{ base: 5, sm: 7 }}
          >
            <HStack spacing={{ base: 2, sm: 3 }} justify="center" flexWrap="nowrap">
              {digits.slice(0, 4).map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (refs.current[index] = el)}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  inputMode="numeric"
                  maxLength={1}
                  textAlign="center"
                  w={{ base: "56px", sm: "68px" }}
                  h={{ base: "72px", sm: "84px" }}
                  borderRadius="18px"
                  borderWidth="1px"
                  borderColor="rgba(255,255,255,0.12)"
                  bg="rgba(8,12,28,0.45)"
                  fontSize={{ base: "2xl", sm: "3xl" }}
                  fontWeight="700"
                  color="white"
                  _focus={{
                    borderColor: "#7d72ff",
                    boxShadow: "0 0 0 1px #7d72ff",
                  }}
                />
              ))}

              <Text
                mx={{ base: 1, sm: 2 }}
                fontSize={{ base: "2xl", sm: "3xl" }}
                color="#6f63ff"
                fontWeight="700"
              >
                -
              </Text>

              {digits.slice(4).map((digit, i) => {
                const index = i + 4;
                return (
                  <Input
                    key={index}
                    ref={(el) => (refs.current[index] = el)}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    inputMode="numeric"
                    maxLength={1}
                    textAlign="center"
                    w={{ base: "56px", sm: "68px" }}
                    h={{ base: "72px", sm: "84px" }}
                    borderRadius="18px"
                    borderWidth="1px"
                    borderColor="rgba(255,255,255,0.12)"
                    bg="rgba(8,12,28,0.45)"
                    fontSize={{ base: "2xl", sm: "3xl" }}
                    fontWeight="700"
                    color="white"
                    _focus={{
                      borderColor: "#7d72ff",
                      boxShadow: "0 0 0 1px #7d72ff",
                    }}
                  />
                );
              })}
            </HStack>

            <Text
              mt={5}
              textAlign="center"
              color="rgba(255,255,255,0.52)"
              fontSize={{ base: "lg", sm: "2xl" }}
              fontWeight="600"
            >
              8-digit TV code
            </Text>
          </Box>

          <Button
            w="full"
            maxW="980px"
            h={{ base: "72px", sm: "88px" }}
            borderRadius="24px"
            bg="linear-gradient(90deg, #6c63ff 0%, #7d72ff 100%)"
            color="white"
            fontSize={{ base: "2xl", sm: "3xl" }}
            fontWeight="700"
            letterSpacing="0.08em"
            isDisabled={code.length !== 8}
            onClick={handleSubmit}
            _hover={{ filter: "brightness(1.05)" }}
            _active={{ filter: "brightness(0.98)" }}
          >
            CONTINUE
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
