import { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Code,
  Heading,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  useClipboard,
} from "@chakra-ui/react";
import { supabase } from "./supabaseClient";

function cleanPaymentUrl() {
  const url = new URL(window.location.href);

  url.searchParams.delete("payment");
  url.searchParams.delete("reference");

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

export default function PaymentConfirmationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [passcode, setPasscode] = useState("");
  const [premiumUntil, setPremiumUntil] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const { hasCopied, onCopy } = useClipboard(passcode);

  useEffect(() => {
    const parameters = new URLSearchParams(
      window.location.search
    );

    const payment = parameters.get("payment");
    const reference = parameters.get("reference");

    if (payment === "cancelled") {
      setScreen("cancelled");
      setIsOpen(true);
      return;
    }

    if (
      payment !== "processing" &&
      payment !== "success"
    ) {
      return;
    }

    setIsOpen(true);

    if (!reference) {
      setScreen("error");
      setErrorMessage(
        "The payment reference is missing. Please check your email or contact support."
      );
      return;
    }

    let stopped = false;
    let timerId;
    let attempts = 0;

    const checkPayment = async () => {
      attempts += 1;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "Your login session expired. Please sign in again."
          );
        }

        const response = await fetch(
          `/api/payment-status?reference=${encodeURIComponent(
            reference
          )}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to confirm your payment."
          );
        }

        if (stopped) return;

        if (data.status === "paid") {
          setPasscode(data.passcode || "");
          setPremiumUntil(data.premium_until || "");
          setEmailSent(Boolean(data.email_sent));
          setScreen("success");
          return;
        }

        if (
          data.status === "pending" ||
          data.status === "processing"
        ) {
          if (attempts >= 30) {
            setScreen("error");
            setErrorMessage(
              "Your payment is still being confirmed. Please wait a moment and refresh this page."
            );
            return;
          }

          timerId = window.setTimeout(
            checkPayment,
            2000
          );

          return;
        }

        setScreen("error");
        setErrorMessage(
          "We could not confirm this payment."
        );
      } catch (error) {
        if (stopped) return;

        setScreen("error");
        setErrorMessage(
          error?.message ||
            "Unable to confirm your payment."
        );
      }
    };

    checkPayment();

    return () => {
      stopped = true;

      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const closeWithoutReload = () => {
    cleanPaymentUrl();
    setIsOpen(false);
  };

  const continueToPremium = () => {
    cleanPaymentUrl();
    window.location.reload();
  };

  const formattedExpiration = premiumUntil
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(premiumUntil))
    : "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeWithoutReload}
      isCentered
      closeOnOverlayClick={false}
      size="md"
    >
      <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(8px)" />

      <ModalContent
        mx={4}
        bg="#151515"
        color="white"
        border="1px solid rgba(255,255,255,0.12)"
        borderRadius="20px"
        boxShadow="0 30px 80px rgba(0,0,0,0.8)"
      >
        {screen === "checking" && (
          <>
            <ModalHeader textAlign="center" pt={8}>
              Confirming your payment
            </ModalHeader>

            <ModalBody pb={8}>
              <VStack spacing={5}>
                <Spinner
                  size="xl"
                  thickness="4px"
                  color="red.500"
                />

                <Text
                  color="gray.300"
                  textAlign="center"
                >
                  PayMongo has returned you to the
                  website. We’re waiting for the secure
                  payment confirmation.
                </Text>

                <Text
                  fontSize="sm"
                  color="gray.500"
                  textAlign="center"
                >
                  Please don’t close this page.
                </Text>
              </VStack>
            </ModalBody>
          </>
        )}

        {screen === "success" && (
          <>
            <ModalHeader textAlign="center" pt={8}>
              <Heading size="lg" color="green.300">
                Payment successful!
              </Heading>
            </ModalHeader>

            <ModalBody>
              <VStack spacing={5} align="stretch">
                <Alert
                  status="success"
                  borderRadius="12px"
                  bg="green.900"
                  color="green.100"
                >
                  <AlertIcon />
                  Your 30-day Premium access is active.
                </Alert>

                <Box
                  p={5}
                  bg="#090909"
                  border="1px solid"
                  borderColor="red.500"
                  borderRadius="14px"
                  textAlign="center"
                >
                  <Text
                    fontSize="xs"
                    color="gray.400"
                    mb={2}
                  >
                    YOUR PREMIUM PASSCODE
                  </Text>

                  <Code
                    px={4}
                    py={2}
                    fontSize="xl"
                    fontWeight="bold"
                    letterSpacing="2px"
                    colorScheme="red"
                    borderRadius="8px"
                  >
                    {passcode}
                  </Code>

                  <Button
                    mt={4}
                    size="sm"
                    variant="outline"
                    colorScheme="red"
                    onClick={onCopy}
                  >
                    {hasCopied
                      ? "Passcode copied"
                      : "Copy passcode"}
                  </Button>
                </Box>

                <Text color="gray.300">
                  <strong>Valid until:</strong>{" "}
                  {formattedExpiration}
                </Text>

                <Text
                  fontSize="sm"
                  color="gray.400"
                >
                  {emailSent
                    ? "Your PayMongo receipt and Premium activation email have been sent."
                    : "Your PayMongo receipt was requested and your Premium activation email is being sent."}
                </Text>

                <Text
                  fontSize="xs"
                  color="gray.500"
                >
                  Keep your Premium passcode private.
                </Text>
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button
                width="100%"
                colorScheme="red"
                onClick={continueToPremium}
              >
                Continue to Premium
              </Button>
            </ModalFooter>
          </>
        )}

        {screen === "cancelled" && (
          <>
            <ModalHeader textAlign="center" pt={8}>
              Payment cancelled
            </ModalHeader>

            <ModalBody>
              <Text
                color="gray.300"
                textAlign="center"
              >
                Your checkout was cancelled and Premium
                access was not activated.
              </Text>
            </ModalBody>

            <ModalFooter>
              <Button
                width="100%"
                onClick={closeWithoutReload}
              >
                Return to Premium
              </Button>
            </ModalFooter>
          </>
        )}

        {screen === "error" && (
          <>
            <ModalHeader textAlign="center" pt={8}>
              Confirmation delayed
            </ModalHeader>

            <ModalBody>
              <Alert
                status="warning"
                borderRadius="12px"
              >
                <AlertIcon />
                {errorMessage}
              </Alert>
            </ModalBody>

            <ModalFooter gap={3}>
              <Button
                variant="ghost"
                onClick={closeWithoutReload}
              >
                Close
              </Button>

              <Button
                colorScheme="red"
                onClick={() =>
                  window.location.reload()
                }
              >
                Try again
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
