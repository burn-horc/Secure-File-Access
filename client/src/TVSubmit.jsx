import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "./supabaseClient";

export default function TVSubmit() {
  const [, setLocation] = useLocation();
  const [digits, setDigits] = useState(Array(8).fill(""));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    if (!pasted) return;

    const updated = Array(8).fill("");
    pasted.split("").forEach((char, i) => {
      updated[i] = char;
    });

    setDigits(updated);
    refs.current[Math.min(pasted.length, 7)]?.focus();
  };

  const code = digits.join("");

  const handleSubmit = async () => {
    if (code.length !== 8) return;

    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in first.");
      }

      const res = await fetch("/api/tv/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code }),
      });

      const payload = await res.json();

      if (!res.ok || !payload.ok) {
        throw new Error(payload.message || "Failed to connect TV.");
      }

      setMessage("TV linked successfully!");
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="#0d0f18" color="white" px={4} py={6}>
      <HStack justify="space-between" maxW="760px" mx="auto" mb={4}>
        <Button
          size="sm"
          borderRadius="14px"
          borderWidth="1px"
          borderColor="rgba(255,255,255,0.12)"
          bg="rgba(255,255,255,0.04)"
          color="white"
          onClick={() => setLocation("/")}
          _hover={{ bg: "rgba(255,255,255,0.08)" }}
        >
          ← Back
        </Button>

        <Text
          fontSize="sm"
          fontWeight="700"
          letterSpacing="0.08em"
          color="rgba(255,255,255,0.55)"
        >
          TV Access
        </Text>

        <Box w="64px" />
      </HStack>

      <Box
        maxW="760px"
        mx="auto"
        borderWidth="1px"
        borderColor="rgba(139,92,246,0.18)"
        borderRadius="28px"
        bg="linear-gradient(180deg, #10162a 0%, #0d1430 100%)"
        boxShadow="0 10px 40px rgba(0,0,0,0.45)"
        px={{ base: 4, sm: 5 }}
        py={{ base: 7, sm: 8 }}
      >
        <VStack spacing={6}>
          <Text
            textAlign="center"
            fontSize={{ base: "2xl", sm: "4xl" }}
            fontWeight="800"
            lineHeight="1.1"
          >
            Match the code on your TV
          </Text>

          <Text
            textAlign="center"
            color="rgba(255,255,255,0.58)"
            fontSize={{ base: "md", sm: "xl" }}
            maxW="520px"
          >
            Confirm or enter the 8-digit code below.
          </Text>

          <Box
            w="full"
            borderWidth="1px"
            borderColor="rgba(255,255,255,0.08)"
            borderRadius="24px"
            bg="rgba(10,14,30,0.35)"
            px={{ base: 2, sm: 4 }}
            py={{ base: 4, sm: 5 }}
            overflow="hidden"
          >
            <HStack spacing={{ base: 2, sm: 3 }} justify="center">
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
                  width={{ base: "44px", sm: "56px" }}
                  height={{ base: "60px", sm: "70px" }}
                  borderRadius="16px"
                  border="1px solid rgba(255,255,255,0.12)"
                  bg="rgba(8,12,28,0.45)"
                  fontSize={{ base: "28px", sm: "34px" }}
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
                fontSize={{ base: "2xl", sm: "3xl" }}
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
                    width={{ base: "44px", sm: "56px" }}
                    height={{ base: "60px", sm: "70px" }}
                    borderRadius="16px"
                    border="1px solid rgba(255,255,255,0.12)"
                    bg="rgba(8,12,28,0.45)"
                    fontSize={{ base: "28px", sm: "34px" }}
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
              fontSize={{ base: "md", sm: "lg" }}
              fontWeight="600"
            >
              8-digit TV code
            </Text>
          </Box>

          <Button
            w="full"
            h={{ base: "64px", sm: "74px" }}
            borderRadius="22px"
            bg="linear-gradient(90deg, #6c63ff 0%, #7d72ff 100%)"
            color="white"
            fontSize={{ base: "xl", sm: "2xl" }}
            fontWeight="700"
            letterSpacing="0.08em"
            isDisabled={code.length !== 8 || loading}
            isLoading={loading}
            onClick={handleSubmit}
            _hover={{ filter: "brightness(1.05)" }}
            _active={{ filter: "brightness(0.98)" }}
          >
            CONTINUE
          </Button>

          {message ? (
            <Text
              textAlign="center"
              color={message.includes("successfully") ? "#00d563" : "#ff6b6b"}
              fontWeight="700"
            >
              {message}
            </Text>
          ) : null}
        </VStack>
      </Box>
    </Box>
  );
}
