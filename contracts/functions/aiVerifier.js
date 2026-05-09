// Chainlink Functions source for AiOracleVerifier
//
// args[0]: criteria     — plain-English description of what participants must show
// args[1]: cids         — comma-separated IPFS CIDs, one per evidence entry ("" if none)
// args[2]: nonces       — comma-separated expected nonces in "0x…" hex, one per CID
//                         Each nonce = keccak256(abi.encodePacked(challengeAddress, day)),
//                         the same value the participant was required to display in their photo.
// args[3]: requiredDays — minimum number of unique valid days needed to pass (decimal)
//
// secrets.geminiApiKey — Google AI Studio API key
// secrets.ipfsGateway  — (optional) IPFS gateway base URL; defaults to https://ipfs.io/ipfs/
//
// Returns Functions.encodeUint256(1) for pass, Functions.encodeUint256(0) for fail.
// Throws on infrastructure / config errors so the DON marks the request errored
// and the contract owner can retry via retryVerification().
//
// Deduplication: multiple evidence entries for the same day share the same expected nonce.
// Once any entry for a given nonce passes, subsequent entries for that day are skipped.

const criteria     = args[0];
const cids         = args[1] ? args[1].split(",") : [];
const nonces       = args[2] ? args[2].split(",") : [];
const requiredDays = parseInt(args[3], 10);

const GEMINI_KEY  = secrets.geminiApiKey;
const GATEWAY     = (secrets.ipfsGateway || "https://ipfs.io/ipfs/").replace(/\/?$/, "/");

if (!GEMINI_KEY)                       throw new Error("secrets.geminiApiKey not set");

const GEMINI_URL  =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
if (isNaN(requiredDays))               throw new Error("Invalid requiredDays arg");
if (cids.length !== nonces.length)     throw new Error("CIDs / nonces length mismatch");

// Edge cases that are deterministic, not infrastructure errors.
if (requiredDays === 0)  return Functions.encodeUint256(1); // trivially satisfied
if (cids.length === 0)   return Functions.encodeUint256(0); // no evidence → fail

const CHUNK = 8_192; // base64 encoding chunk size (avoids spread-operator stack overflow)

// validNonces accumulates nonces (= days) for which at least one evidence entry passed.
const validNonces = new Set();

for (let i = 0; i < cids.length; i++) {
    const cid           = cids[i].trim();
    const expectedNonce = nonces[i].trim();

    // Short-circuit: this day already has a passing entry.
    if (validNonces.has(expectedNonce)) continue;

    // ── 1. Fetch image from IPFS ──────────────────────────────────────────────
    const imgResp = await Functions.makeHttpRequest({
        url:          GATEWAY + cid,
        responseType: "arraybuffer",
        timeout:      15_000,
    });
    if (imgResp.error || imgResp.status !== 200) continue; // unreachable CID — try next entry

    // Detect MIME type from magic bytes.
    const bytes = new Uint8Array(imgResp.data);
    const isWebp = bytes.length >= 12
        && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    const mimeType = (bytes[0] === 0x89 && bytes[1] === 0x50) ? "image/png"
        : isWebp ? "image/webp"
        : "image/jpeg";

    // Base64-encode in chunks (O(n) join, not O(n²) repeated concatenation).
    const parts = [];
    for (let j = 0; j < bytes.length; j += CHUNK) {
        parts.push(String.fromCharCode(...bytes.subarray(j, j + CHUNK)));
    }
    const imageBase64 = btoa(parts.join(""));

    // ── 2. Ask Gemini Vision to evaluate the evidence ─────────────────────────
    const prompt =
        `You are an impartial verifier for a personal challenge.\n` +
        `Challenge criteria: "${criteria}"\n` +
        `Required nonce (must appear as readable text in the image): "${expectedNonce}"\n\n` +
        `Respond ONLY with a raw JSON object on one line (no markdown, no extra text):\n` +
        `{"criteriaMet": <true|false>, "nonceVisible": <true|false>}\n\n` +
        `criteriaMet  — true if the image clearly shows the participant performed: ${criteria}\n` +
        `nonceVisible — true if the exact string "${expectedNonce}" is legibly visible in the image`;

    const geminiResp = await Functions.makeHttpRequest({
        url:    GEMINI_URL,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: imageBase64 } },
                ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 64 },
        },
        timeout: 30_000,
    });
    if (geminiResp.error || geminiResp.status !== 200) continue; // Gemini unavailable — try next

    // ── 3. Parse Gemini's response ────────────────────────────────────────────
    // Extract the first {...} object from the response to tolerate minor formatting deviations.
    let answer;
    try {
        const raw   = geminiResp.data.candidates[0].content.parts[0].text;
        const match = raw.match(/\{[^{}]*\}/);
        answer = match ? JSON.parse(match[0]) : null;
    } catch (_) {
        continue; // unparseable response — treat as not verified, try next entry
    }

    if (answer && answer.criteriaMet === true && answer.nonceVisible === true) {
        validNonces.add(expectedNonce);
    }
}

return Functions.encodeUint256(validNonces.size >= requiredDays ? 1 : 0);
