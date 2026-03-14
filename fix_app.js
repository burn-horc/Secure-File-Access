const fs = require('fs');
let appCode = fs.readFileSync('client/src/App.jsx', 'utf8');

const importReplacement = `import { useEffect, useMemo, useRef, useState } from "react";
import { useToast, Button, Center, VStack, Heading, Text, Box } from "@chakra-ui/react";
import CheckerPage from "./CheckerPage";
import { showAppToast } from "./appToast.jsx";
import { useAuth } from "./hooks/use-auth";

const MAX_JSON_PAYLOAD_BYTES = 850_000;`;

const oldImportStr = `import { useEffect, useMemo, useRef, useState } from "react";\nimport { useToast } from "@chakra-ui/react";\nimport CheckerPage from "./CheckerPage";\nimport { showAppToast } from "./appToast.jsx";\nconst MAX_JSON_PAYLOAD_BYTES = 850_000;`;

appCode = appCode.replace(oldImportStr, importReplacement);

// We need to add login check to App component
const appStartReplacement = `export default function App() {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const toast = useToast();`;

appCode = appCode.replace(`export default function App() {\n  const toast = useToast();`, appStartReplacement);

const returnReplacement = `  if (isAuthLoading) {
    return (
      <Center h="100vh" bg="#050509">
        <Text color="gray.400">Loading...</Text>
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Center h="100vh" bg="#050509" flexDir="column" gap={6}>
        <VStack spacing={4} align="center">
          <Heading color="white" size="xl">Burn • NTFLX Engine</Heading>
          <Text color="gray.400" textAlign="center" maxW="md">
            Please log in with your Replit account to access the Netflix account checker.
          </Text>
          <Button 
            colorScheme="orange" 
            size="lg" 
            onClick={() => window.location.href = "/api/login"}
            mt={4}
          >
            Log In with Replit
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Box position="relative">
      <Box position="absolute" top={4} right={4} zIndex={10}>
        <Button 
          variant="outline" 
          colorScheme="red" 
          size="sm" 
          onClick={() => logout()}
        >
          Logout ({user?.firstName || user?.email || "User"})
        </Button>
      </Box>
      <CheckerPage`;

appCode = appCode.replace(/  return \(\s*<CheckerPage/, returnReplacement);

fs.writeFileSync('client/src/App.jsx', appCode);
