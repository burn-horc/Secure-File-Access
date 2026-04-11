
import { useEffect, useState } from "react";

export default function TVScreen() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("waiting");
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/tv/generate", {
        method: "POST",
      });

      const data = await res.json();
      setCode(data.code);

      const interval = setInterval(async () => {
        const r = await fetch(`/api/tv/status/${data.code}`);
        const s = await r.json();

        if (s.status === "connected") {
          setStatus("connected");
          setResult(s.result);
          clearInterval(interval);
        }
      }, 2000);
    }

    init();
  }, []);

  return (
    <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>
      {status === "waiting" && <h1>{code}</h1>}
      {status === "connected" && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
