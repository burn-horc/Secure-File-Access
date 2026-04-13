import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";

function CodeBoxes({ code = "" }) {
  const padded = code.padEnd(8, " ").slice(0, 8).split("");
  const left = padded.slice(0, 4);
  const right = padded.slice(4, 8);

  const boxStyle = {
    w: { base: "56px", sm: "68px" },
    h: { base: "72px", sm: "84px" },
    borderRadius: "18px",
    borderWidth: "1px",
    borderColor: "rgba(255,255,255,0.12)",
    bg: "rgba(8,12,28,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: { base: "2xl", sm: "3xl" },
    fontWeight: "700",
    color: "white",
  };

  return (
    <HStack spacing={{ base: 2, sm: 3 }} justify="center" flexWrap="nowrap">
      {left.map((digit, index) => (
        <Box key={`l-${index}`} {...boxStyle}>
          {digit.trim() ? digit : ""}
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

      {right.map((digit, index) => (
        <Box key={`r-${index}`} {...boxStyle}>
          {digit.trim() ? digit : ""}
        </Box>
      ))}
    </HStack>
  );
}

export default function TVScreen() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("waiting");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let interval;

    async function init() {
      const res = await fetch("/api/tv/generate", {
        method: "POST",
      });

      const data = await res.json();
      const generatedCode = String(data.code || "");
      setCode(generatedCode);

      interval = setInterval(async () => {
        const r = await fetch(`/api/tv/status/${generatedCode}`);
        const s = await r.json();

        if (s.status === "connected") {
          setStatus("connected");
          setResult(s.result || null);
          clearInterval(interval);
        }
      }, 2000);
    }

    init();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

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
          {status === "waiting" && (
            <>
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
                Enter this 8-digit code on your other device.
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
                <CodeBoxes code={code} />

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
            </>
          )}

          {status === "connected" && (
            <>
              <Text
                textAlign="center"
                fontSize={{ base: "3xl", sm: "4xl" }}
                fontWeight="800"
                color="#00d563"
              >
                Connected
              </Text>

              <Box
                w="full"
                maxW="980px"
                borderWidth="1px"
                borderColor="rgba(0,213,99,0.25)"
                borderRadius="24px"
                bg="rgba(0,213,99,0.06)"
                p={6}
              >
                <Box
                  as="pre"
                  whiteSpace="pre-wrap"
                  fontSize="sm"
                  color="rgba(255,255,255,0.88)"
                >
                  {JSON.stringify(result, null, 2)}
                </Box>
              </Box>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
