const res = await fetch("/api/tv/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
});

const text = await res.text();
console.log("STATUS:", res.status);
console.log("BODY:", text);

if (!res.ok) {
  setStatus("error");
  return;
}

const data = JSON.parse(text);
