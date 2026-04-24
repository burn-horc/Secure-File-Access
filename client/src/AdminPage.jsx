import { useState, useEffect } from "react";
import { Box, Button, VStack, Text, Input, HStack } from "@chakra-ui/react";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [passcode, setPasscode] = useState("");

  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);

  const ADMIN_PASS = "admin123"; // 🔥 change this

  const handleLogin = () => {
    if (passcode === ADMIN_PASS) {
      setAuthorized(true);
      fetchCodes();
    } else {
      alert("Wrong passcode");
    }
  };

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/get-codes");
      const data = await res.json();
      setCodes(data.codes || []);
    } catch {
      alert("Failed to fetch");
    }
    setLoading(false);
  };

  const generateCode = async () => {
    try {
      const res = await fetch("/api/generate-random-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          passcode: "HDSzRCv052496*" // 🔥 your backend passcode
        })
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error);
        return;
      }

      fetchCodes();
    } catch {
      alert("Error generating code");
    }
  };

  const deleteCode = async (id) => {
    try {
      await fetch("/api/admin/delete-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
      });

      fetchCodes();
    } catch {
      alert("Delete failed");
    }
  };

  if (!authorized) {
    return (
      <Box p={10}>
        <VStack>
          <Text>Admin Login</Text>
          <Input
            type="password"
            placeholder="Enter admin passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <Button onClick={handleLogin}>Login</Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={6}>
      <VStack spacing={4} align="stretch">

        <HStack>
          <Button onClick={generateCode}>⚡ Generate Code</Button>
          <Button onClick={fetchCodes}>🔄 Refresh</Button>
        </HStack>

        {loading && <Text>Loading...</Text>}

        {codes.map((c) => (
          <Box
            key={c.id}
            p={3}
            border="1px solid #7c6cff"
            borderRadius="10px"
          >
            <HStack justify="space-between">
              <Text>{c.code}</Text>
              <Button size="sm" onClick={() => deleteCode(c.id)}>
                Delete
              </Button>
            </HStack>
          </Box>
        ))}

      </VStack>
    </Box>
  );
}
