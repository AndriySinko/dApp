// PACT AI Oracle — Flexible Verifier v2
//
// Criteria format (two modes, auto-detected):
//
//   1. IPFS:   "ipfs:QmXyz..."   → fetch JSON config from IPFS
//   2. Plain:  any other string  → use as the Gemini prompt criteria directly (legacy)
//
// JSON Criteria Schema (IPFS mode):
// {
//   "requiredDays": 30,          // minimum passing days (overrides args[3])
//   "graceDays": 2,              // allowed missed days (requiredDays out of total)
//   "prompt": "Does this image show {criteria} AND the nonce {nonce} is visibly written?",
//   "timeWindow": {              // optional: evidence must be from this time-of-day window
//     "startHour": 6,
//     "endHour": 10
//   },
//   "strictNonce": true,         // default true — require nonce visible in photo
//   "multiPhotoPerDay": false,   // default false — first passing photo wins for the day
//   "passCriteria": "ALL"        // ALL (default) or MAJORITY (>50% of days)
// }
//
// args[0]: criteria string (ipfs:CID | plain description)
// args[1]: comma-separated IPFS CIDs of evidence photos
// args[2]: comma-separated expected nonces (hex)
// args[3]: requiredDays (can be overridden by JSON config)
//
// secrets.geminiApiKey — Google AI Studio API key
// secrets.ipfsGateway  — optional custom gateway
//
// Returns encodeUint256(1) for pass, encodeUint256(0) for fail.

const IPFS_GATEWAY = ((secrets && secrets.ipfsGateway) || "https://ipfs.io/ipfs/").replace(/\/?$/, "/");
const GEMINI_KEY   = secrets && secrets.geminiApiKey;
const GEMINI_URL   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_KEY;
const CHUNK        = 8192;

if (!GEMINI_KEY) throw new Error("secrets.geminiApiKey not set");

// ── Load criteria config ──────────────────────────────────────────────────────

const criteriaRaw  = args[0] || "";
const cids         = args[1] ? args[1].split(",").map(s => s.trim()).filter(Boolean) : [];
const nonces       = args[2] ? args[2].split(",").map(s => s.trim()).filter(Boolean) : [];
const requiredDaysArg = parseInt(args[3] || "1", 10);

async function loadConfig(raw) {
    if (raw.startsWith("ipfs:")) {
        const cid  = raw.slice(5).trim();
        const resp = await Functions.makeHttpRequest({ url: IPFS_GATEWAY + cid, timeout: 10000 });
        if (resp.error || resp.status !== 200) throw new Error("IPFS criteria fetch failed");
        const data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
        return {
            requiredDays:    data.requiredDays    ?? requiredDaysArg,
            graceDays:       data.graceDays       ?? 0,
            promptTemplate:  data.prompt          || null,
            timeWindow:      data.timeWindow      || null,
            strictNonce:     data.strictNonce     !== false,
            passCriteria:    data.passCriteria    || "ALL",
            rawCriteria:     data.criteria        || raw,
        };
    }
    return {
        requiredDays:   requiredDaysArg,
        graceDays:      0,
        promptTemplate: null,
        timeWindow:     null,
        strictNonce:    true,
        passCriteria:   "ALL",
        rawCriteria:    raw,
    };
}

// ── Build Gemini prompt ───────────────────────────────────────────────────────

function buildPrompt(config, expectedNonce) {
    const criteria = config.rawCriteria;

    if (config.promptTemplate) {
        return config.promptTemplate
            .replace(/{criteria}/g, criteria)
            .replace(/{nonce}/g,    expectedNonce);
    }

    if (!config.strictNonce) {
        return (
            "You are an impartial verifier for a personal challenge.\n" +
            "Challenge criteria: \"" + criteria + "\"\n\n" +
            "Respond ONLY with a raw JSON object on one line:\n" +
            "{\"criteriaMet\": <true|false>}\n\n" +
            "criteriaMet — true if the image clearly shows the participant performed: " + criteria
        );
    }

    return (
        "You are an impartial verifier for a personal challenge.\n" +
        "Challenge criteria: \"" + criteria + "\"\n" +
        "Required nonce (must appear as readable text in the image): \"" + expectedNonce + "\"\n\n" +
        "Respond ONLY with a raw JSON object on one line (no markdown, no extra text):\n" +
        "{\"criteriaMet\": <true|false>, \"nonceVisible\": <true|false>}\n\n" +
        "criteriaMet  — true if the image clearly shows the participant performed: " + criteria + "\n" +
        "nonceVisible — true if the exact string \"" + expectedNonce + "\" is legibly visible in the image"
    );
}

// ── Fetch and encode image ────────────────────────────────────────────────────

async function fetchImage(cid) {
    const resp = await Functions.makeHttpRequest({
        url: IPFS_GATEWAY + cid,
        responseType: "arraybuffer",
        timeout: 15000,
    });
    if (resp.error || resp.status !== 200) return null;

    const bytes = new Uint8Array(resp.data);
    const isWebp = bytes.length >= 12
        && bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46
        && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50;
    const mimeType = (bytes[0]===0x89 && bytes[1]===0x50) ? "image/png"
        : isWebp ? "image/webp" : "image/jpeg";

    const parts = [];
    for (let j = 0; j < bytes.length; j += CHUNK) {
        parts.push(String.fromCharCode(...bytes.subarray(j, j+CHUNK)));
    }
    return { base64: btoa(parts.join("")), mimeType };
}

// ── Ask Gemini ────────────────────────────────────────────────────────────────

async function askGemini(prompt, image) {
    const resp = await Functions.makeHttpRequest({
        url:    GEMINI_URL,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: image.mimeType, data: image.base64 } },
                ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 64 },
        },
        timeout: 30000,
    });
    if (resp.error || resp.status !== 200) return null;

    try {
        const raw   = resp.data.candidates[0].content.parts[0].text;
        const match = raw.match(/\{[^{}]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (_) {
        return null;
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    if (cids.length === 0) return Functions.encodeUint256(0);

    const config = await loadConfig(criteriaRaw);

    if (config.requiredDays === 0) return Functions.encodeUint256(1);
    if (cids.length !== nonces.length) throw new Error("CIDs/nonces length mismatch");

    const validNonces = new Set();

    for (let i = 0; i < cids.length; i++) {
        const cid           = cids[i];
        const expectedNonce = nonces[i];

        if (validNonces.has(expectedNonce)) continue; // day already validated

        const image = await fetchImage(cid);
        if (!image) continue;

        const prompt = buildPrompt(config, expectedNonce);
        const answer = await askGemini(prompt, image);
        if (!answer) continue;

        const criteriaOk = answer.criteriaMet === true;
        const nonceOk    = !config.strictNonce || answer.nonceVisible === true;

        if (criteriaOk && nonceOk) {
            validNonces.add(expectedNonce);
        }
    }

    const validDays  = validNonces.size;
    const totalDays  = new Set(nonces).size;
    const required   = config.requiredDays - config.graceDays;

    let passed;
    if (config.passCriteria === "MAJORITY") {
        passed = validDays > totalDays / 2;
    } else {
        passed = validDays >= Math.max(1, required);
    }

    return Functions.encodeUint256(passed ? 1 : 0);
}

return main();
