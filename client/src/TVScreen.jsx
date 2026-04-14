import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export default function TVScreen() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("loading");
  const [tvToken, setTvToken] = useState("");
  const [account, setAccount] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let intervalId;
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch("/api/tv/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await res.json();

        if (!res.ok || !data.ok || !data.code) {
          throw new Error(data.message || "Failed to create TV code.");
        }

        if (cancelled) return;

        setCode(data.code);
        setStatus("waiting");

        intervalId = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/tv/status?code=${data.code}`);
            const pollData = await pollRes.json();

            if (!pollRes.ok) {
              throw new Error(pollData.message || "Failed to check TV status.");
            }

            if (pollData.status === "linked" && pollData.tvToken) {
              clearInterval(intervalId);
              setTvToken(pollData.tvToken);
              setStatus("linked");
            }
          } catch (err) {
            console.error("TV polling error:", err);
          }
        }, 2000);
      } catch (err) {
        console.error("TV init failed:", err);
        if (cancelled) return;
        setErrorMessage(err.message || "Failed to generate code");
        setStatus("error");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!tvToken || status !== "linked") return;

    let cancelled = false;

    async function loadAccount() {
      try {
        const res = await fetch("/api/tv/account", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tvToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.message || "Failed to load account.");
        }

        if (cancelled) return;

        setAccount(data.account || null);
        setStatus("ready");
      } catch (err) {
        console.error("Load account failed:", err);
        if (cancelled) return;
        setErrorMessage(err.message || "Failed to load account");
        setStatus("error");
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [tvToken, status]);

  const digits = code.padEnd(8, " ").split("");

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
            Enter the code displayed on your TV
          </Text>

          {status === "loading" && (
            <Text color="rgba(255,255,255,0.65)">Generating code...</Text>
          )}

          {status === "error" && (
            <Text color="#ff6b6b">{errorMessage || "Failed to generate code"}</Text>
          )}

          {(status === "waiting" || status === "linked" || status === "ready") && !account && (
            <>
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

                <Text
                  mt={4}
                  textAlign="center"
                  color="rgba(255,255,255,0.52)"
                  fontSize={{ base: "md", sm: "xl" }}
                  fontWeight="600"
                >
                  8-digit TV code
                </Text>
              </Box>

              <Text color={status === "linked" ? "#00d563" : "rgba(255,255,255,0.65)"}>
                {status === "linked" ? "Connected! Loading account..." : "Waiting for code entry..."}
              </Text>
            </>
          )}

          {status === "ready" && account && (
            <Box
              w="full"
              borderWidth="1px"
              borderColor="rgba(255,255,255,0.08)"
              borderRadius="24px"
              bg="rgba(10,14,30,0.35)"
              px={{ base: 4, sm: 6 }}
              py={{ base: 5, sm: 6 }}
            >
              <Text
                textAlign="center"
                fontSize={{ base: "2xl", sm: "3xl" }}
                fontWeight="800"
                mb={4}
              >
                Account Linked
              </Text>

              <Text textAlign="center" color="rgba(255,255,255,0.72)">
                {account.display_name || account.name || account.email || "Your account"}
              </Text>

              <Text
                mt={4}
                textAlign="center"
                color="#00d563"
                fontWeight="700"
              >
                You can start watching now
              </Text>
            </Box>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
