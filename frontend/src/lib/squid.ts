const SQUID_URL = process.env.NEXT_PUBLIC_SQUID_URL ?? "";

export async function squidQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!SQUID_URL) return { data: {} } as T;
    const res = await fetch(SQUID_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) console.error("Squid query errors:", json.errors);
    return json.data as T;
}
