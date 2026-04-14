import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export default function TVScreen() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let interval;

    async function init() {
      try {
        const res = await fetch("/api/tv/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const text = await res.text();
        console.log("tv/generate status:", res.status);
        console.log("tv/generate body:", text);

        if (!res.ok) {
          setStatus("error");
          return;
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          setStatus("error");
          return;
        }

        if (!data.success || !data.code) {
          setStatus("error");
          return;
        }

        setCode(data.code);
        setStatus("waiting");

        interval = setInterval(async () => {
          try {
            const r = await fetch(`/api/tv/status/${data.code}`);
            const s = await r.json();

            if (s.status === "connected") {
              setStatus("connected");
              clearInterval(interval);
            }
          } catch {
            // ignore polling error
          }
        }, 2000);
      } catch (err) {
        console.error("tv/generate request failed:", err);
        setStatus("error");
      }
    }

    init();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

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
            <Text color="#ff6b6b">Failed to generate code</Text>
          )}

          {(status === "waiting" || status === "connected") && (
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

              <Text color={status === "connected" ? "#00d563" : "rgba(255,255,255,0.65)"}>
                {status === "connected" ? "Connected!" : "Waiting for code entry..."}
              </Text>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
