import { Box, Button, Flex, HStack, Text, VStack } from "@chakra-ui/react";
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
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
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
    async function init() {
      const res = await fetch("/api/tv/generate", { method: "POST" });
      const data = await res.json();
      setCode(data.code || "");

      const interval = setInterval(async () => {
        const r = await fetch(`/api/tv/status/${data.code}`);
        const s = await r.json();

        if (s.status === "connected") {
          setStatus("connected");
          setResult(s.result);
          clearInterval(interval);
        }
      }, 2000);
    }

    init();
  }, []);

  return (
    <Box minH="100vh" bg="#0b1020" color="white">
      <Box
        maxW="1100px"
        mx="auto"
        px={{ base: 3, sm: 4 }}
        py={{ base: 6, sm: 8 }}
      >
        <Box
          borderWidth="1px"
          borderColor="rgba(139,92,246,0.18)"
          borderRadius="28px"
          bg="linear-gradient(180deg, #10162a 0%, #0d1430 100%)"
          boxShadow="0 10px 40px rgba(0,0,0,0.45)"
          overflow="hidden"
        >
          

          <VStack spacing={8} px={{ base: 3, sm: 6 }} py={{ base: 10, sm: 14 }}>
            {status === "waiting" && (
              <>
                <Text color="#1fe0c1" fontSize={{ base: "3xl", sm: "4xl" }} fontWeight="700">
                  Hi!
                </Text>

                <Text
                  textAlign="center"
                  fontSize={{ base: "4xl", sm: "6xl" }}
                  fontWeight="800"
                  lineHeight="1.05"
                  maxW="900px"
                >
                  Match the code on your TV
                </Text>

                <Text
                  textAlign="center"
                  color="rgba(255,255,255,0.58)"
                  fontSize={{ base: "lg", sm: "2xl" }}
                  maxW="900px"
                >
                  Confirm or enter the code below to connect to this device.
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
                  _hover={{ filter: "brightness(1.05)" }}
                  _active={{ filter: "brightness(0.98)" }}
                >
                  CONTINUE
                </Button>
              </>
            )}

            {status === "connected" && (
              <Box
                w="full"
                maxW="980px"
                borderWidth="1px"
                borderColor="rgba(0,213,99,0.25)"
                borderRadius="24px"
                bg="rgba(0,213,99,0.06)"
                p={6}
              >
                <Text fontSize="2xl" fontWeight="800" color="#00d563" mb={4}>
                  Connected
                </Text>
                <Box
                  as="pre"
                  whiteSpace="pre-wrap"
                  fontSize="sm"
                  color="rgba(255,255,255,0.88)"
                >
                  {JSON.stringify(result, null, 2)}
                </Box>
              </Box>
            )}
          </VStack>
        </Box>

        <Text
          textAlign="center"
          mt={6}
          color="rgba(255,255,255,0.45)"
          fontSize={{ base: "sm", sm: "lg" }}
        >
          © Fyodor Dostoevsky. All Rights Reserved.
        </Text>
      </Box>
    </Box>
  );
}
