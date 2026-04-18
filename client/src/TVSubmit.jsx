import { Box, Button, Text, VStack, HStack, Input } from "@chakra-ui/react";
import { useMemo, useState } from "react";

function sanitizeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

export default function TVSubmit() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const digits = useMemo(() => sanitizeCode(code).padEnd(8, " ").split(""), [code]);

  async function handleSubmit() {
  const cleaned = sanitizeCode(code);

  if (cleaned.length !== 8) {
    setError("Enter full 8-digit code");
    return;
  }

  setLoading(true);
  setError("");

  try {
    // 🔥 open immediately (important for iPhone)
    const win = window.open("about:blank", "_blank");

    if (!win) {
      alert("Popup blocked");
      return;
    }

    // loading UI
    win.document.write("<h2 style='color:white;background:#0d0f18;height:100vh;display:flex;align-items:center;justify-content:center;'>Connecting...</h2>");

    // fetch token
    const res = await fetch("/api/get-tv-link", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ passcode }) // if needed
});

    if (!data.ok || !data.account?.tvLink) {
      win.document.body.innerHTML = "<h2>Failed to connect</h2>";
      return;
    }

    // redirect
    win.location.href = data.account.tvLink;

    setMessage("Now enter the same code on Netflix");

  } catch (err) {
    setError("Something went wrong");
  } finally {
    setLoading(false);
  }
}
  return (
    <Box minH="100vh" bg="#0d0f18" color="white" px={4} py={8}>
      <Box
        maxW="720px"
        mx="auto"
        borderWidth="1px"
        borderColor="rgba(139,92,246,0.18)"
        borderRadius="28px"
        bg="linear-gradient(180deg, #10162a 0%, #0d1430 100%)"
        boxShadow="0 10px 40px rgba(0,0,0,0.45)"
        px={{ base: 4, sm: 6 }}
        py={{ base: 8, sm: 10 }}
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

          <Box
            w="full"
            borderWidth="1px"
            borderColor="rgba(255,255,255,0.08)"
            borderRadius="24px"
            bg="rgba(10,14,30,0.35)"
            px={{ base: 3, sm: 5 }}
            py={{ base: 5, sm: 6 }}
          >
            <HStack spacing={{ base: 2, sm: 3 }} justify="center">
              {digits.slice(0, 4).map((digit, index) => (
                <Box
                  key={index}
                  w={{ base: "52px", sm: "62px" }}
                  h={{ base: "68px", sm: "76px" }}
                  borderRadius="18px"
                  border="1px solid rgba(255,255,255,0.12)"
                  bg="rgba(8,12,28,0.45)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize={{ base: "2xl", sm: "3xl" }}
                  fontWeight="700"
                >
                  {digit.trim() || ""}
                </Box>
              ))}

              <Text
                mx={{ base: 1, sm: 2 }}
                fontSize={{ base: "2xl", sm: "3xl" }}
                color="#6f63ff"
                fontWeight="700"
              >
                -
              </Text>

              {digits.slice(4).map((digit, index) => (
                <Box
                  key={index + 4}
                  w={{ base: "52px", sm: "62px" }}
                  h={{ base: "68px", sm: "76px" }}
                  borderRadius="18px"
                  border="1px solid rgba(255,255,255,0.12)"
                  bg="rgba(8,12,28,0.45)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize={{ base: "2xl", sm: "3xl" }}
                  fontWeight="700"
                >
                  {digit.trim() || ""}
                </Box>
              ))}
            </HStack>

            <Input
              mt={5}
              value={code}
              onChange={(e) => setCode(sanitizeCode(e.target.value))}
              placeholder="Enter 8-digit code"
              inputMode="numeric"
              maxLength={8}
              textAlign="center"
              fontSize="lg"
              color="white"
              borderColor="rgba(255,255,255,0.12)"
              _placeholder={{ color: "rgba(255,255,255,0.4)" }}
              _focus={{
                borderColor: "#6f63ff",
                boxShadow: "0 0 0 1px #6f63ff",
              }}
            />
          </Box>

          <Button
            w="full"
            h="56px"
            borderRadius="18px"
            bg="#6f63ff"
            color="white"
            _hover={{ bg: "#5e54db" }}
            _active={{ bg: "#5248c7" }}
            isLoading={loading}
            loadingText="Connecting"
            onClick={handleSubmit}
          >
            Continue
          </Button>

          {!!message && (
            <Text color="#00d563" fontWeight="700" textAlign="center">
              {message}
            </Text>
          )}

          {!!error && (
            <Text color="#ff6b6b" fontWeight="700" textAlign="center">
              {error}
            </Text>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
