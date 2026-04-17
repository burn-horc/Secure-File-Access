import { useMemo, useState } from "react";

export default function TVSubmit() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanCode = code.replace(/\D/g, "").slice(0, 8);
  const isValid = cleanCode.length === 8;

  const formattedCode = useMemo(() => {
    if (cleanCode.length <= 4) return cleanCode;
    return `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`;
  }, [cleanCode]);

  const tvLink = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tvlink") || "";
  }, []);

  const handleContinue = async () => {
    const finalLink = tvLink || "https://www.netflix.com/tv2";

const win = window.open("about:blank", "_blank");

if (win) {
  win.location.href = finalLink;
} else {
  window.location.href = finalLink;
}
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const codeBoxes = Array.from({ length: 8 }, (_, index) => cleanCode[index] || "");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #070b18 0%, #050814 100%)",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "54px",
            height: "54px",
            borderRadius: "16px",
            background: "rgba(124,108,255,0.15)",
            border: "1px solid rgba(124,108,255,0.28)",
            marginBottom: "18px",
            fontSize: "24px",
          }}
        >
          📺
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "0.02em",
          }}
        >
          Enter TV Code
        </h1>

        <p
          style={{
            marginTop: "10px",
            marginBottom: "28px",
            color: "rgba(255,255,255,0.62)",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          Enter the 8-digit code shown on your TV screen to continue.
        </p>

        <input
          value={cleanCode}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={8}
          autoFocus
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        <div
          onClick={() => {
            const hiddenInput = document.getElementById("tv-hidden-code-input");
            hiddenInput?.focus();
          }}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "18px",
          }}
        >
          {codeBoxes.map((digit, index) => (
            <div
              key={index}
              style={{
                width: "38px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700,
                boxShadow: digit ? "0 0 0 1px rgba(124,108,255,0.18) inset" : "none",
              }}
            >
              {digit}
            </div>
          ))}
        </div>

        <input
          id="tv-hidden-code-input"
          value={cleanCode}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={8}
          autoFocus
          style={{
            width: "1px",
            height: "1px",
            opacity: 0,
            position: "absolute",
            left: "-9999px",
          }}
        />

        <div
          style={{
            marginBottom: "24px",
            fontSize: "13px",
            color: "rgba(255,255,255,0.52)",
            letterSpacing: "0.18em",
          }}
        >
          {formattedCode || "____-____"}
        </div>

        <button
          onClick={handleContinue}
          disabled={!isValid || loading}
          style={{
            width: "100%",
            height: "56px",
            borderRadius: "16px",
            border: "none",
            fontSize: "16px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "white",
            background:
              !isValid || loading
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(135deg, #7c6cff 0%, #9d5cff 100%)",
            cursor: !isValid || loading ? "not-allowed" : "pointer",
            boxShadow:
              !isValid || loading
                ? "none"
                : "0 16px 32px rgba(124,108,255,0.28)",
          }}
        >
          {loading ? "CONNECTING..." : "CONTINUE"}
        </button>
      </div>
    </div>
  );
}
