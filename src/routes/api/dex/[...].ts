export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/dex", "");
  const searchParams = url.searchParams;

  const targetUrl = new URL(path, "https://api.dexscreener.com");
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch from DexScreener" }),
      {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
