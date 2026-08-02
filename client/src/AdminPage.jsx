import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";

const CODE_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

const inputStyle = {
  bg: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "white",
  _placeholder: {
    color: "rgba(255,255,255,0.3)",
  },
  _focus: {
    borderColor: "#8b5cf6",
    boxShadow: "0 0 0 1px #8b5cf6",
  },
};

function localDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return adjusted.toISOString().slice(0, 16);
}

function defaultExpiry() {
  return localDateTime(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
}

function generateCode() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const bytes = new Uint8Array(10);

  window.crypto.getRandomValues(bytes);

  const value = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length]
  ).join("");

  return `PREM-${value.slice(0, 5)}-${value.slice(5)}`;
}

function formatDate(value) {
  if (!value) return "Unlimited";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function statusStyle(user) {
  if (user.is_admin) {
    return {
      label: "ADMIN",
      bg: "rgba(168,85,247,.15)",
      color: "#c084fc",
    };
  }

  if (user.status === "active") {
    return {
      label: "ACTIVE",
      bg: "rgba(34,197,94,.13)",
      color: "#4ade80",
    };
  }

  if (user.status === "expired") {
    return {
      label: "EXPIRED",
      bg: "rgba(245,158,11,.13)",
      color: "#fbbf24",
    };
  }

  return {
    label: "FREE",
    bg: "rgba(148,163,184,.12)",
    color: "#94a3b8",
  };
}

export default function AdminPage({ session }) {
  const toast = useToast();
  const token = session?.access_token || "";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");

  const [grant, setGrant] = useState({
    email: "",
    code: "",
    unlimited: false,
    expiresAt: defaultExpiry(),
  });

  const [edit, setEdit] = useState(null);

  const request = useCallback(
    async (method = "GET", body, query = "") => {
      if (!token) {
        throw new Error(
          "Your login session has expired."
        );
      }

      const response = await fetch(
        `/api/admin/premium-users${query}`,
        {
          method,
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body
              ? {
                  "Content-Type": "application/json",
                }
              : {}),
          },
          body: body
            ? JSON.stringify(body)
            : undefined,
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Request failed."
        );
      }

      return data;
    },
    [token]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request();

      setUsers(
        Array.isArray(data.users)
          ? data.users
          : []
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load accounts."
      );
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    if (!value) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.passcode?.code,
        user.source,
      ]
        .filter(Boolean)
        .some((item) =>
          String(item)
            .toLowerCase()
            .includes(value)
        )
    );
  }, [search, users]);

  const validateCode = (code) => {
    if (CODE_PATTERN.test(code)) {
      return true;
    }

    toast({
      title: "Invalid passcode",
      description:
        "Use 8–32 letters, numbers, underscores, or hyphens.",
      status: "error",
      duration: 3500,
      isClosable: true,
    });

    return false;
  };

  const grantPremium = async () => {
    const email = grant.email
      .trim()
      .toLowerCase();

    const code = grant.code.trim();

    if (!email) {
      toast({
        title: "Customer email is required.",
        status: "error",
      });

      return;
    }

    if (!validateCode(code)) {
      return;
    }

    if (
      !grant.unlimited &&
      !grant.expiresAt
    ) {
      toast({
        title: "Choose an expiration date.",
        status: "error",
      });

      return;
    }

    setBusy("grant");

    try {
      await request("POST", {
        email,
        code,
        unlimited: grant.unlimited,
        expires_at: grant.unlimited
          ? null
          : new Date(
              grant.expiresAt
            ).toISOString(),
      });

      setGrant({
        email: "",
        code: "",
        unlimited: false,
        expiresAt: defaultExpiry(),
      });

      await loadUsers();

      toast({
        title: "Premium access granted.",
        status: "success",
      });
    } catch (caught) {
      toast({
        title: "Unable to grant Premium",
        description:
          caught instanceof Error
            ? caught.message
            : "Try again.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setBusy("");
    }
  };

  const beginEdit = (user) => {
    setEdit({
      user,
      code: user.passcode?.code || "",
      unlimited:
        user.is_admin ||
        !user.premium_until,
      expiresAt: localDateTime(
        user.premium_until
      ),
    });
  };

  const saveEdit = async () => {
    if (!edit) return;

    const code = edit.code.trim();

    if (!validateCode(code)) {
      return;
    }

    if (
      !edit.user.is_admin &&
      !edit.unlimited &&
      !edit.expiresAt
    ) {
      toast({
        title: "Choose an expiration date.",
        status: "error",
      });

      return;
    }

    const body = {
      user_id: edit.user.user_id,
      passcode_id:
        edit.user.passcode?.id,
      code,
    };

    if (!edit.user.is_admin) {
      body.unlimited = edit.unlimited;

      body.expires_at =
        edit.unlimited
          ? null
          : new Date(
              edit.expiresAt
            ).toISOString();
    }

    setBusy(
      `edit-${edit.user.user_id}`
    );

    try {
      await request("PATCH", body);

      setEdit(null);

      await loadUsers();

      toast({
        title: "Premium account updated.",
        status: "success",
      });
    } catch (caught) {
      toast({
        title: "Unable to update account",
        description:
          caught instanceof Error
            ? caught.message
            : "Try again.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setBusy("");
    }
  };

  const revokePremium = async (user) => {
    if (user.is_admin) return;

    const confirmed = window.confirm(
      `Revoke Premium access for ${user.email}?`
    );

    if (!confirmed) return;

    setBusy(
      `revoke-${user.user_id}`
    );

    try {
      await request(
        "DELETE",
        null,
        `?user_id=${encodeURIComponent(
          user.user_id
        )}`
      );

      await loadUsers();

      toast({
        title: "Premium access revoked.",
        status: "success",
      });
    } catch (caught) {
      toast({
        title: "Unable to revoke Premium",
        description:
          caught instanceof Error
            ? caught.message
            : "Try again.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setBusy("");
    }
  };

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code);

    toast({
      title: "Passcode copied.",
      status: "success",
      duration: 1800,
    });
  };

  return (
    <Box
      minH="100vh"
      bg="#080a12"
      color="white"
      px={4}
      py={7}
    >
      <Box maxW="1050px" mx="auto">
        <Flex
          justify="space-between"
          align="center"
          gap={4}
          mb={7}
          flexWrap="wrap"
        >
          <Box>
            <Text
              fontSize="xs"
              color="#a78bfa"
              fontWeight="800"
              letterSpacing=".12em"
            >
              ADMINISTRATION
            </Text>

            <Heading
              mt={1}
              fontSize={{
                base: "2xl",
                md: "3xl",
              }}
            >
              Premium Accounts
            </Heading>

            <Text
              mt={2}
              fontSize="sm"
              color="gray.500"
            >
              Manage users, passcodes, and
              expiration dates.
            </Text>
          </Box>

          <HStack>
            <Button
              size="sm"
              variant="outline"
              borderColor="whiteAlpha.300"
              onClick={() => {
                window.location.href =
                  "/premium";
              }}
            >
              Back
            </Button>

            <Button
              size="sm"
              bg="#7c3aed"
              _hover={{
                bg: "#8b5cf6",
              }}
              onClick={loadUsers}
              isLoading={loading}
            >
              Refresh
            </Button>
          </HStack>
        </Flex>

        <SimpleGrid
          columns={{
            base: 1,
            md: 2,
          }}
          spacing={4}
          mb={5}
        >
          <Box
            bg="#111525"
            border="1px solid rgba(139,92,246,.2)"
            borderRadius="16px"
            p={5}
          >
            <Text
              fontSize="xs"
              color="gray.500"
            >
              ACCOUNTS LISTED
            </Text>

            <Text
              fontSize="3xl"
              fontWeight="800"
            >
              {users.length}
            </Text>
          </Box>

          <Box
            bg="#111525"
            border="1px solid rgba(34,197,94,.18)"
            borderRadius="16px"
            p={5}
          >
            <Text
              fontSize="xs"
              color="gray.500"
            >
              ACTIVE PREMIUM
            </Text>

            <Text
              fontSize="3xl"
              fontWeight="800"
              color="#4ade80"
            >
              {
                users.filter(
                  (user) =>
                    user.is_admin ||
                    user.status === "active"
                ).length
              }
            </Text>
          </Box>
        </SimpleGrid>

        <Box
          bg="#111525"
          border="1px solid rgba(139,92,246,.2)"
          borderRadius="18px"
          p={{
            base: 4,
            md: 6,
          }}
          mb={5}
        >
          <Heading fontSize="md">
            Grant Premium manually
          </Heading>

          <Text
            fontSize="xs"
            color="gray.500"
            mt={1}
            mb={4}
          >
            The customer must already have a
            registered website account.
          </Text>

          <SimpleGrid
            columns={{
              base: 1,
              md: 2,
            }}
            spacing={3}
          >
            <Input
              type="email"
              placeholder="Customer email"
              value={grant.email}
              onChange={(event) =>
                setGrant({
                  ...grant,
                  email:
                    event.target.value,
                })
              }
              {...inputStyle}
            />

            <HStack>
              <Input
                placeholder="Custom passcode"
                value={grant.code}
                onChange={(event) =>
                  setGrant({
                    ...grant,
                    code:
                      event.target.value,
                  })
                }
                fontFamily="monospace"
                {...inputStyle}
              />

              <Button
                onClick={() =>
                  setGrant({
                    ...grant,
                    code: generateCode(),
                  })
                }
                bg="purple.700"
              >
                Generate
              </Button>
            </HStack>

            <Input
              type="datetime-local"
              value={grant.expiresAt}
              onChange={(event) =>
                setGrant({
                  ...grant,
                  expiresAt:
                    event.target.value,
                })
              }
              isDisabled={
                grant.unlimited
              }
              {...inputStyle}
            />

            <Flex align="center">
              <Checkbox
                colorScheme="purple"
                isChecked={
                  grant.unlimited
                }
                onChange={(event) =>
                  setGrant({
                    ...grant,
                    unlimited:
                      event.target.checked,
                  })
                }
              >
                Unlimited access
              </Checkbox>
            </Flex>
          </SimpleGrid>

          <Button
            mt={4}
            bg="linear-gradient(135deg,#6d28d9,#8b5cf6)"
            onClick={grantPremium}
            isLoading={busy === "grant"}
          >
            Grant Premium
          </Button>
        </Box>

        <Box
          bg="#111525"
          border="1px solid rgba(255,255,255,.08)"
          borderRadius="18px"
          p={{
            base: 4,
            md: 6,
          }}
        >
          <Flex
            justify="space-between"
            align="center"
            gap={3}
            mb={4}
            flexWrap="wrap"
          >
            <Heading fontSize="md">
              User access
            </Heading>

            <Input
              maxW="330px"
              placeholder="Search email, name, or passcode"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              {...inputStyle}
            />
          </Flex>

          {loading ? (
            <Text
              py={10}
              textAlign="center"
              color="gray.500"
            >
              Loading accounts...
            </Text>
          ) : error ? (
            <Text
              py={8}
              textAlign="center"
              color="red.300"
            >
              {error}
            </Text>
          ) : filteredUsers.length === 0 ? (
            <Text
              py={8}
              textAlign="center"
              color="gray.500"
            >
              No accounts found.
            </Text>
          ) : (
            <VStack
              align="stretch"
              spacing={3}
            >
              {filteredUsers.map(
                (user) => {
                  const badge =
                    statusStyle(user);

                  const editing =
                    edit?.user.user_id ===
                    user.user_id;

                  return (
                    <Box
                      key={user.user_id}
                      bg="rgba(255,255,255,.025)"
                      border="1px solid rgba(255,255,255,.07)"
                      borderRadius="14px"
                      p={4}
                    >
                      <Flex
                        justify="space-between"
                        gap={4}
                        direction={{
                          base: "column",
                          md: "row",
                        }}
                      >
                        <Box
                          minW={0}
                          flex="1"
                        >
                          <HStack
                            flexWrap="wrap"
                            mb={1}
                          >
                            <Text fontWeight="800">
                              {user.name ||
                                "Unnamed user"}
                            </Text>

                            <Badge
                              bg={badge.bg}
                              color={
                                badge.color
                              }
                              borderRadius="full"
                              px={2}
                            >
                              {badge.label}
                            </Badge>

                            <Badge
                              bg="rgba(59,130,246,.12)"
                              color="#93c5fd"
                              borderRadius="full"
                              px={2}
                            >
                              {user.source ||
                                "none"}
                            </Badge>
                          </HStack>

                          <Text
                            fontSize="sm"
                            color="gray.400"
                            wordBreak="break-all"
                          >
                            {user.email}
                          </Text>

                          <SimpleGrid
                            columns={{
                              base: 1,
                              md: 2,
                            }}
                            spacing={3}
                            mt={3}
                          >
                            <Box>
                              <Text
                                fontSize="2xs"
                                color="gray.600"
                              >
                                PASSCODE
                              </Text>

                              <HStack mt={1}>
                                <Text
                                  fontFamily="monospace"
                                  color="#c4b5fd"
                                  wordBreak="break-all"
                                >
                                  {user
                                    .passcode
                                    ?.code ||
                                    "No active passcode"}
                                </Text>

                                {user
                                  .passcode
                                  ?.code && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    color="#a78bfa"
                                    onClick={() =>
                                      copyCode(
                                        user
                                          .passcode
                                          .code
                                      )
                                    }
                                  >
                                    Copy
                                  </Button>
                                )}
                              </HStack>
                            </Box>

                            <Box>
                              <Text
                                fontSize="2xs"
                                color="gray.600"
                              >
                                EXPIRATION
                              </Text>

                              <Text
                                mt={1}
                                fontSize="sm"
                              >
                                {user.is_admin
                                  ? "Unlimited (Admin)"
                                  : formatDate(
                                      user.premium_until
                                    )}
                              </Text>
                            </Box>
                          </SimpleGrid>

                          {user.payment
                            ?.reference_number && (
                            <Text
                              mt={3}
                              fontSize="2xs"
                              color="gray.600"
                              wordBreak="break-all"
                            >
                              Payment reference:{" "}
                              {
                                user
                                  .payment
                                  .reference_number
                              }
                            </Text>
                          )}
                        </Box>

                        <HStack
                          alignSelf={{
                            base: "stretch",
                            md: "flex-start",
                          }}
                        >
                          <Button
                            size="sm"
                            flex={{
                              base: 1,
                              md: "initial",
                            }}
                            bg="purple.800"
                            isDisabled={
                              !user.passcode
                            }
                            onClick={() =>
                              editing
                                ? setEdit(
                                    null
                                  )
                                : beginEdit(
                                    user
                                  )
                            }
                          >
                            {editing
                              ? "Cancel"
                              : "Edit"}
                          </Button>

                          {!user.is_admin &&
                            user.premium && (
                              <Button
                                size="sm"
                                flex={{
                                  base: 1,
                                  md: "initial",
                                }}
                                colorScheme="red"
                                variant="outline"
                                isLoading={
                                  busy ===
                                  `revoke-${user.user_id}`
                                }
                                onClick={() =>
                                  revokePremium(
                                    user
                                  )
                                }
                              >
                                Revoke
                              </Button>
                            )}
                        </HStack>
                      </Flex>

                      {editing && (
                        <Box
                          mt={4}
                          pt={4}
                          borderTop="1px solid rgba(255,255,255,.08)"
                        >
                          <SimpleGrid
                            columns={{
                              base: 1,
                              md: 2,
                            }}
                            spacing={3}
                          >
                            <Input
                              value={
                                edit.code
                              }
                              onChange={(
                                event
                              ) =>
                                setEdit({
                                  ...edit,
                                  code:
                                    event
                                      .target
                                      .value,
                                })
                              }
                              placeholder="New passcode"
                              {...inputStyle}
                            />

                            {!user.is_admin && (
                              <Input
                                type="datetime-local"
                                value={
                                  edit.expiresAt
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEdit({
                                    ...edit,
                                    expiresAt:
                                      event
                                        .target
                                        .value,
                                  })
                                }
                                isDisabled={
                                  edit.unlimited
                                }
                                {...inputStyle}
                              />
                            )}
                          </SimpleGrid>

                          {!user.is_admin && (
                            <Checkbox
                              mt={3}
                              colorScheme="purple"
                              isChecked={
                                edit.unlimited
                              }
                              onChange={(
                                event
                              ) =>
                                setEdit({
                                  ...edit,
                                  unlimited:
                                    event
                                      .target
                                      .checked,
                                })
                              }
                            >
                              Unlimited access
                            </Checkbox>
                          )}

                          <Button
                            mt={3}
                            bg="#7c3aed"
                            onClick={
                              saveEdit
                            }
                            isLoading={
                              busy ===
                              `edit-${user.user_id}`
                            }
                          >
                            Save changes
                          </Button>
                        </Box>
                      )}
                    </Box>
                  );
                }
              )}
            </VStack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
