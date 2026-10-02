const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function apiPost(path: string, data: any) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  let errorMsg = "";
  if (!res.ok) {
    const rawText = await res.text();
    try {
      const json = JSON.parse(rawText);
      errorMsg = json.message || JSON.stringify(json);
    } catch {
      errorMsg = rawText;
    }
    throw new Error(errorMsg);
  }
  return res.json();
} 