import { useMemo, useState } from "react";
import { Box, Button, HStack, Input, Text, VStack } from "@chakra-ui/react";

export default function TVSubmit() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cleanCode = useMemo(() => value.replace(/\D/g, "").slice(0, 8), [value]);
  const isValid = cleanCode.length === 8;

  const boxes = useMemo(() => {
    const chars = cleanCode.split("");
    while (chars.length < 8) chars.push("");
    return chars;
  }, [cleanCode]);

  const handleChange = (e) => {
    setError("");
    setValue(e.target.value.replace(/\D/g, "").slice(0, 8));
  };

const handleContinue = async () => {
  if (!isValid || loading) return;

  setLoading(true);
  setError("");

  try {
    const res = await fetch("/api/tv/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: cleanCode }),
    });

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || "Failed to connect");
    }

    window.location.href = `/tv-connect?code=${cleanCode}`;
  } catch (err) {
    console.error(err);
    setError(err?.message || "Error connecting TV");
  } finally {
    setLoading(false);
  }
};

    // 🔥 AFTER linking, go to TV connect page
    window.location.href = `/tv-connect?code=${cleanCode}`;

  } catch (err) {
    console.error(err);
    alert("Error connecting TV");
  }
};
  
 
  return (
    <Box minH="100vh" bg="#050b1d" px={4} py={8} color="white">
      <VStack maxW="760px" mx="auto" spacing={6} align="stretch">
        <Text textAlign="center" fontSize="2xl" fontWeight="700">
          TV Access
        </Text>

        <Box
          bg="#0a1230"
          border="1px solid rgba(120,120,255,0.25)"
          borderRadius="32px"
          px={{ base: 5, md: 10 }}
          py={{ base: 8, md: 12 }}
        >
          <VStack spacing={6}>
            <Text fontSize={{ base: "3xl", md: "5xl" }} fontWeight="800" textAlign="center">
              Match the code on your TV
            </Text>

            <Text fontSize={{ base: "lg", md: "2xl" }} opacity={0.7} textAlign="center">
              Confirm or enter the 8-digit code below.
            </Text>

            <Box
              w="100%"
              bg="#07102a"
              border="1px solid rgba(255,255,255,0.08)"
              borderRadius="28px"
              px={4}
              py={8}
              position="relative"
            >
              <Input
                position="absolute"
                inset={0}
                opacity={0}
                value={value}
                onChange={handleChange}
                inputMode="numeric"
                autoFocus
                maxLength={8}
              />

              <HStack justify="center" spacing={3} mb={6}>
                {boxes.slice(0, 4).map((char, idx) => (
                  <Box
                    key={`left-${idx}`}
                    w={{ base: "52px", md: "70px" }}
                    h={{ base: "76px", md: "92px" }}
                    borderRadius="24px"
                    border="1px solid rgba(255,255,255,0.14)"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize={{ base: "2xl", md: "3xl" }}
                    fontWeight="700"
                  >
                    {char}
                  </Box>
                ))}

                <Text fontSize="3xl" color="#7f7cff" px={2}>
                  -
                </Text>

                {boxes.slice(4, 8).map((char, idx) => (
                  <Box
                    key={`right-${idx}`}
                    w={{ base: "52px", md: "70px" }}
                    h={{ base: "76px", md: "92px" }}
                    borderRadius="24px"
                    border="1px solid rgba(255,255,255,0.14)"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize={{ base: "2xl", md: "3xl" }}
                    fontWeight="700"
                  >
                    {char}
                  </Box>
                ))}
              </HStack>

              <Text textAlign="center" fontSize={{ base: "2xl", md: "3xl" }} opacity={0.65}>
                8-digit TV code
              </Text>
            </Box>

            <Button
              onClick={handleContinue}
              isDisabled={!isValid || loading}
              isLoading={loading}
              w="100%"
              h="72px"
              borderRadius="full"
              bg="#5858d7"
              _hover={{ bg: "#6666e6" }}
              fontSize="2xl"
              fontWeight="800"
              letterSpacing="0.08em"
            >
              CONTINUE
            </Button>

            {error ? (
              <Text color="red.300" textAlign="center">
                {error}
              </Text>
            ) : null}
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
