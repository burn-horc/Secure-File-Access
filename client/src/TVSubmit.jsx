import { Box, Button, HStack, IconButton, Text, VStack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";

export default function TVSubmit() {
  const [, setLocation] = useLocation();
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

    if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 7) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 8);

    if (!pasted) return;

    const updated = Array(8).fill("");
    pasted.split("").forEach((char, i) => {
      updated[i] = char;
    });

    setDigits(updated);

    const nextIndex = Math.min(pasted.length, 7);
    refs.current[nextIndex]?.focus();
  };

  const code = digits.join("");

  const handleSubmit = async () => {
    if (code.length !== 8) return;

    try {
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
    } catch (err) {
      console.error(err);
      alert("Request failed");
    }
  };

  return (
    <Box minH="100vh" bg="#0d0f18" color="white" px={3} py={4}>
      <Box maxW="560px" mx="auto">
        <HStack mb={3} justify="space-between" align="center">
          <Button
            size="sm"
            borderRadius="12px"
            bg="rgba(255,255,255,0.06)"
            border="1px solid rgba(255,255,255,0.12)"
            color="white"
            _hover={{ bg: "rgba(255,255,255,0.1)" }}
            onClick={() => setLocation("/")}
          >
            ← Back
          </Button>

          <Text
            fontSize="sm"
            color="rgba(255,255,255,0.55)"
            fontWeight="600"
            letterSpacing="0.04em"
          >
            TV Access
          </Text>

          <Box w="62px" />
        </HStack>

        <Box
          borderWidth="1px"
          borderColor="rgba(139,92,246,0.18)"
          borderRadius="24px"
          bg="linear-gradient(160deg, #181e35 0%, #0f1220 100%)"
          boxShadow="0 8px 32px rgba(0,0,0,0.65)"
          px={{ base: 4, sm: 5 }}
          py={{ base: 6, sm: 7 }}
        >
          <VStack spacing={5}>
            <Text
              textAlign="center"
              fontSize={{ base: "2xl", sm: "3xl" }}
              fontWeight="800"
              lineHeight="1.1"
            >
              Match the code on your TV
            </Text>

            <Text
              textAlign="center"
              color="rgba(255,255,255,0.58)"
              fontSize={{ base: "md", sm: "lg" }}
              maxW="420px"
              lineHeight="1.5"
            >
              Confirm or enter the 8-digit code below.
            </Text>

            <Box
              w="full"
              borderWidth="1px"
              borderColor="rgba(255,255,255,0.08)"
              borderRadius="22px"
              bg="rgba(10,14,30,0.35)"
              px={{ base: 2, sm: 3 }}
              py={{ base: 4, sm: 5 }}
              overflow="hidden"
            >
              <HStack spacing={{ base: 1.5, sm: 2 }} justify="center">
                {digits.slice(0, 4).map((digit, index) => (
                  <Box
                    key={index}
                    as="input"
                    ref={(el) => (refs.current[index] = el)}
                    value={digit || ""}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    textAlign="center"
                    width={{ base: "44px", sm: "52px" }}
                    minW={{ base: "44px", sm: "52px" }}
                    height={{ base: "58px", sm: "64px" }}
                    borderRadius="16px"
                    border="1px solid rgba(255,255,255,0.12)"
                    bg="rgba(8,12,28,0.45)"
                    fontSize={{ base: "20px", sm: "24px" }}
                    fontWeight="700"
                    color="white"
                    caretColor="white"
                    sx={{
                      WebkitTextFillColor: "white",
                      outline: "none",
                    }}
                  />
                ))}

                <Text
                  mx={{ base: 0.5, sm: 1 }}
                  fontSize={{ base: "20px", sm: "24px" }}
                  color="#6f63ff"
                  fontWeight="700"
                >
                  -
                </Text>

                {digits.slice(4).map((digit, i) => {
                  const index = i + 4;
                  return (
                    <Box
                      key={index}
                      as="input"
                      ref={(el) => (refs.current[index] = el)}
                      value={digit || ""}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      textAlign="center"
                      width={{ base: "44px", sm: "52px" }}
                      minW={{ base: "44px", sm: "52px" }}
                      height={{ base: "58px", sm: "64px" }}
                      borderRadius="16px"
                      border="1px solid rgba(255,255,255,0.12)"
                      bg="rgba(8,12,28,0.45)"
                      fontSize={{ base: "20px", sm: "24px" }}
                      fontWeight="700"
                      color="white"
                      caretColor="white"
                      sx={{
                        WebkitTextFillColor: "white",
                        outline: "none",
                      }}
                    />
                  );
                })}
              </HStack>

              <Text
                mt={4}
                textAlign="center"
                color="rgba(255,255,255,0.52)"
                fontSize={{ base: "sm", sm: "md" }}
                fontWeight="600"
              >
                8-digit TV code
              </Text>
            </Box>

            <Button
              w="full"
              h={{ base: "58px", sm: "64px" }}
              borderRadius="18px"
              bg="linear-gradient(90deg, #6c63ff 0%, #7d72ff 100%)"
              color="white"
              fontSize={{ base: "xl", sm: "2xl" }}
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
    </Box>
  );
}
