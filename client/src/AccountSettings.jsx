import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";

const CODE_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

function formatDate(value) {
  if (!value) return "Unlimited";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString();
}

export default function AccountSettings({ session }) {
  const toast = useToast();
  const token = session?.access_token || "";

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!token) {
          throw new Error(
            "Your login session has expired."
          );
        }

        const response = await fetch(
          "/api/account-status",
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load account settings."
          );
        }

        if (!cancelled) {
          setAccount(data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load account settings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const savePasscode = async () => {
    const code = newCode.trim();

    if (!CODE_PATTERN.test(code)) {
      toast({
        title: "Invalid passcode",
        description:
          "Use 8–32 letters, numbers, underscores, or hyphens.",
        status: "error",
        isClosable: true,
      });

      return;
    }

    if (code !== confirmCode.trim()) {
      toast({
        title: "Passcodes do not match.",
        status: "error",
      });

      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/account-status",
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            passcode: code,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update your passcode."
        );
      }

      setAccount((current) => ({
        ...current,
        passcode: data.passcode,
      }));

      setNewCode("");
      setConfirmCode("");

      toast({
        title: "Premium passcode updated",
        description:
          "Your new passcode is active immediately.",
        status: "success",
        isClosable: true,
      });
    } catch (caught) {
      toast({
        title: "Unable to update passcode",
        description:
          caught instanceof Error
            ? caught.message
            : "Please try again.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const copyPasscode = async () => {
    if (!account?.passcode) return;

    await navigator.clipboard.writeText(
      account.passcode
    );

    toast({
      title: "Passcode copied.",
      status: "success",
      duration: 1800,
    });
  };

  const inputStyle = {
    bg: "rgba(255,255,255,.05)",
    borderColor: "rgba(255,255,255,.12)",
    borderRadius: "12px",
    color: "white",
    _placeholder: {
      color: "rgba(255,255,255,.3)",
    },
    _focus: {
      borderColor: "#8b5cf6",
      boxShadow: "0 0 0 1px #8b5cf6",
    },
  };

  return (
    <Flex
      minH="100vh"
      bg="#080a12"
      color="white"
      align="center"
      justify="center"
      px={4}
      py={8}
    >
      <Box
        w="full"
        maxW="560px"
        bg="#111525"
        border="1px solid rgba(139,92,246,.22)"
        borderRadius="20px"
        boxShadow="0 24px 70px rgba(0,0,0,.55)"
        p={{ base: 5, md: 7 }}
      >
        <Flex
          justify="space-between"
          align="flex-start"
          gap={4}
          mb={6}
        >
          <Box>
            <Text
              fontSize="xs"
              color="#a78bfa"
              fontWeight="800"
              letterSpacing=".12em"
            >
              ACCOUNT
            </Text>

            <Heading mt={1} fontSize="2xl">
              Premium Settings
            </Heading>
          </Box>

          <Button
            size="sm"
            variant="outline"
            borderColor="whiteAlpha.300"
            onClick={() => {
              window.location.href = "/premium";
            }}
          >
            Back
          </Button>
        </Flex>

        {loading ? (
          <Text
            py={10}
            textAlign="center"
            color="gray.500"
          >
            Loading account...
          </Text>
        ) : error ? (
          <Text
            p={4}
            borderRadius="12px"
            bg="rgba(239,68,68,.08)"
            color="red.300"
          >
            {error}
          </Text>
        ) : (
          <VStack align="stretch" spacing={5}>
            <Box
              p={4}
              borderRadius="14px"
              bg="rgba(255,255,255,.03)"
              border="1px solid rgba(255,255,255,.08)"
            >
              <HStack
                justify="space-between"
                align="flex-start"
              >
                <Box minW={0}>
                  <Text
                    fontSize="xs"
                    color="gray.500"
                  >
                    SIGNED-IN EMAIL
                  </Text>

                  <Text
                    mt={1}
                    fontWeight="700"
                    wordBreak="break-all"
                  >
                    {account?.email ||
                      session?.user?.email}
                  </Text>
                </Box>

                <Badge
                  bg={
                    account?.is_admin
                      ? "rgba(168,85,247,.15)"
                      : "rgba(34,197,94,.13)"
                  }
                  color={
                    account?.is_admin
                      ? "#c084fc"
                      : "#4ade80"
                  }
                  borderRadius="full"
                  px={3}
                  py={1}
                >
                  {account?.is_admin
                    ? "ADMIN"
                    : "PREMIUM"}
                </Badge>
              </HStack>

              <Text
                mt={4}
                fontSize="xs"
                color="gray.500"
              >
                ACCESS EXPIRATION
              </Text>

              <Text mt={1} fontSize="sm">
                {account?.is_admin
                  ? "Unlimited (Admin)"
                  : formatDate(
                      account?.premium_until
                    )}
              </Text>
            </Box>

            {!account?.has_active_premium ? (
              <Text
                p={4}
                borderRadius="12px"
                bg="rgba(245,158,11,.08)"
                color="orange.200"
              >
                An active Premium account is
                required to change a passcode.
              </Text>
            ) : (
              <>
                <Box>
                  <Text
                    fontSize="xs"
                    color="gray.500"
                    mb={2}
                  >
                    CURRENT PASSCODE
                  </Text>

                  <HStack>
                    <Box
                      flex="1"
                      px={4}
                      py={3}
                      bg="rgba(139,92,246,.08)"
                      border="1px solid rgba(139,92,246,.2)"
                      borderRadius="12px"
                    >
                      <Text
                        color="#c4b5fd"
                        fontFamily="monospace"
                        fontWeight="700"
                        wordBreak="break-all"
                      >
                        {account?.passcode ||
                          "No active passcode"}
                      </Text>
                    </Box>

                    <Button
                      bg="purple.700"
                      onClick={copyPasscode}
                      isDisabled={
                        !account?.passcode
                      }
                    >
                      Copy
                    </Button>
                  </HStack>
                </Box>

                <Box
                  p={4}
                  borderRadius="14px"
                  bg="rgba(255,255,255,.025)"
                  border="1px solid rgba(255,255,255,.08)"
                >
                  <Heading fontSize="md">
                    Change your passcode
                  </Heading>

                  <Text
                    fontSize="xs"
                    color="gray.500"
                    mt={1}
                    mb={4}
                  >
                    Use 8–32 letters, numbers,
                    underscores, or hyphens.
                    Passcodes are case-sensitive.
                  </Text>

                  <VStack
                    align="stretch"
                    spacing={3}
                  >
                    <Input
                      placeholder="New passcode"
                      value={newCode}
                      onChange={(event) =>
                        setNewCode(
                          event.target.value
                        )
                      }
                      {...inputStyle}
                    />

                    <Input
                      placeholder="Confirm new passcode"
                      value={confirmCode}
                      onChange={(event) =>
                        setConfirmCode(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          savePasscode();
                        }
                      }}
                      {...inputStyle}
                    />

                    <Button
                      bg="linear-gradient(135deg,#6d28d9,#8b5cf6)"
                      onClick={savePasscode}
                      isLoading={saving}
                      isDisabled={
                        !newCode.trim() ||
                        !confirmCode.trim()
                      }
                    >
                      Save new passcode
                    </Button>
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        )}
      </Box>
    </Flex>
  );
}
