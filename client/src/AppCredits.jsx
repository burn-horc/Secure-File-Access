import { Text } from "@chakra-ui/react";

const DEFAULT_COPY = "\u00A9 2026 SATISACROH. All Rights Reserved.";

export default function AppCredits({ copy = DEFAULT_COPY, ...props }) {
  return (
    <Text
      m={0}
      mx="auto"
      maxW="96ch"
      textAlign="center"
      fontSize={{ base: "0.67rem", sm: "0.72rem" }}
      fontWeight="600"
      letterSpacing="0.04em"
      color="rgba(255,255,255,0.46)"
      {...props}
    >
      {copy}
    </Text>
  );
}
