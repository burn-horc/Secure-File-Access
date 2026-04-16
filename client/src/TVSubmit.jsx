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
      const res = await fetch("/api/tv/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: cleanCode,
        }),
      });

      const data = await res.json().catch(() => ({}));
      console.log("tv-submit response:", data);

      if (!res.ok || !data?.ok) {
        alert(data?.message || "Failed to connect TV");
        return;
      }

      alert("TV linked successfully!");
      window.location.href = "/tv";
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
