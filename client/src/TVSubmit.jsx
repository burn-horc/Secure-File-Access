import { useState } from "react";

export default function TVSubmit() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanCode = code.replace(/\D/g, "").slice(0, 8);
  const isValid = cleanCode.length === 8;

  const handleContinue = async () => {
    if (!isValid || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/find-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passcode: cleanCode,
        }),
      });

      const data = await res.json();
      console.log("find-account response:", data);

      if (!res.ok || data?.success === false) {
        alert(data?.error || "Request failed");
        return;
      }

      const result = data?.results?.[0];

      if (!result) {
        alert("No account result returned");
        return;
      }

      if (!result?.nftokenLink) {
        alert("No link returned");
        return;
      }

      const win = window.open("about:blank", "_blank");
      if (win) {
        win.location.href = result.nftokenLink;
      } else {
        window.location.href = result.nftokenLink;
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Enter TV Code</h2>

      <input
        value={cleanCode}
        onChange={(e) => setCode(e.target.value)}
        placeholder="________"
        maxLength={8}
        style={{
          fontSize: "24px",
          textAlign: "center",
          letterSpacing: "10px",
        }}
      />

      <br /><br />

      <button onClick={handleContinue} disabled={!isValid || loading}>
        {loading ? "Connecting..." : "CONTINUE"}
      </button>
    </div>
  );
}
