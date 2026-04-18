import handler from "./find-account"; // reuse your logic

export default async function tvHandler(req, res) {
  // call your existing handler logic manually (or refactor slightly)

  const result = await handlerInternal(req); // pseudo

  const valid = result?.results?.find(r => r?.valid);

  if (!valid) {
    return res.status(404).json({ ok: false });
  }

  const nftoken = valid.nftoken || valid.nfToken || valid.token;

  const tvLink = nftoken
    ? `https://www.netflix.com/tv8?nftoken=${nftoken}`
    : null;

  return res.status(200).json({
    ok: true,
    tvLink
  });
}
