import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
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

      if (index > 0) refs.current[index - 1]?.focus();
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

    const focusIndex = Math.min(pasted.length, 7);
    refs.current[focusIndex]?.focus();
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
    <Box minH="100vh" bg="#0b1020" color="white" px={4} py={8}>
      <Box
        maxW="520px"
        mx="auto"
        borderWidth="1px"
        borderColor="rgba(139,92,246,0.18)"
        borderRadius="24px"
        bg="linear-gradient(180deg, #10162a 0%, #0d1430 100%)"
        boxShadow="0 10px 40px rgba(0,0,0,0.45)"
        px={6}
        py={10}
      >
        <VStack spacing={6}>
          <Text
            textAlign="center"
            fontSize="3xl"
            fontWeight="800"
            lineHeight="1.1"
          >
            Match the code on your TV
          </Text>

          <Text
            textAlign="center"
            color="rgba(255,255,255,0.58)"
            fontSize="lg"
          >
            Confirm or enter the 8-digit code below.
          </Text>

          <Box
            w="full"
            borderWidth="1px"
            borderColor="rgba(255,255,255,0.08)"
            borderRadius="24px"
            bg="rgba(10,14,30,0.35)"
            px={4}
            py={5}
          >
            <HStack spacing={2} justify="center">
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
                  w="48px"
                  h="60px"
                  borderRadius="14px"
                  border="1px solid rgba(255,255,255,0.12)"
                  bg="rgba(8,12,28,0.45)"
                  fontSize="22px"
                  fontWeight="700"
                  color="white"
                  caretColor="white"
                  sx={{
                    WebkitTextFillColor: "white",
                    outline: "none",
                  }}
                />
              ))}

              <Text fontSize="22px" color="#6f63ff" fontWeight="700">
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
                    w="48px"
                    h="60px"
                    borderRadius="14px"
                    border="1px solid rgba(255,255,255,0.12)"
                    bg="rgba(8,12,28,0.45)"
                    fontSize="22px"
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
              fontSize="sm"
              fontWeight="600"
            >
              8-digit TV code
            </Text>
          </Box>

          <Button
            w="full"
            h="64px"
            borderRadius="20px"
            bg="linear-gradient(90deg, #6c63ff 0%, #7d72ff 100%)"
            color="white"
            fontSize="xl"
            fontWeight="700"
            letterSpacing="0.08em"
            isDisabled={code.length !== 8}
            onClick={handleSubmit}
          >
            CONTINUE
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
