// PACT API Oracle — Expression Engine v2
//
// Criteria format (three modes, auto-detected):
//
//   1. IPFS:    "ipfs:QmXyz..."         → fetch full JSON criteria from IPFS
//   2. Inline:  "{...}"                 → parse JSON directly from criteria string
//   3. Legacy:  "github:commits:..."    → backward-compatible flat DSL
//
// JSON Criteria Schema:
// {
//   "version": 2,
//   "sources": [
//     {
//       "id": "mySource",
//       "type": "http",
//       "url": "https://api.example.com/data?user={accountId}&from={startEpoch}",
//       "headers": { "Authorization": "Bearer {secret.apiKey}" },
//       "auth": "bearer:{accountId}",          // optional shorthand
//       "extract": "data.total_count",          // dot path or aggregation
//       "extractAlt": "data.items.length"       // fallback if extract returns null
//     }
//   ],
//   "evaluate": {
//     "op": "AND",                              // AND / OR / NOT
//     "conditions": [
//       { "op": "gte", "left": "mySource", "right": 30 },
//       { "op": "lte", "left": "mySource2", "right": 100 }
//     ]
//   }
// }
//
// Simple single-condition evaluate (no AND/OR wrapper):
//   "evaluate": { "op": "gte", "left": "mySource", "right": 30 }
//
// Supported operators: gte, lte, gt, lt, eq, neq, between, exists, streak
// Supported extract aggregations: |sum, |count, |avg, |max, |min, |first, |last
// URL interpolation: {accountId}, {startEpoch}, {endEpoch}, {participant}, {secret.NAME}
//
// args[0] = criteria string (ipfs:CID | JSON string | legacy DSL)
// args[1] = serviceAccountId from bindAccount()
// args[2] = startEpoch (challenge join deadline, unix seconds)
// args[3] = endEpoch   (challenge deadline, unix seconds)
// args[4] = participant wallet address (optional)
//
// secrets.* = any named DON secret (githubToken, stravaToken, geminiKey, etc.)

// ── Constants ────────────────────────────────────────────────────────────────

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
const MAX_HTTP_RETRIES = 1;

// ── Entry point ──────────────────────────────────────────────────────────────

const criteriaRaw   = args[0] || "";
const accountId     = args[1] || "";
const startEpoch    = parseInt(args[2] || "0",  10);
const endEpoch      = parseInt(args[3] || "0",  10);
const participantAddr = args[4] || "";

const startISO = new Date(startEpoch * 1000).toISOString();
const endISO   = new Date(endEpoch   * 1000).toISOString();

// ── Load criteria ────────────────────────────────────────────────────────────

async function loadCriteria(raw) {
    if (raw.startsWith("ipfs:")) {
        const cid  = raw.slice(5).trim();
        const resp = await httpGet(IPFS_GATEWAY + cid);
        if (resp.error) throw new Error("IPFS fetch failed: " + resp.error);
        return typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    }
    if (raw.startsWith("{")) {
        return JSON.parse(raw);
    }
    return parseLegacy(raw);
}

// ── Legacy DSL parser (backward compatible) ──────────────────────────────────
// Format: service:metric:operator:threshold[:startEpoch:endEpoch]
// or old: service:metric:threshold:startEpoch:endEpoch

function parseLegacy(raw) {
    const parts = raw.split(":");
    const service = parts[0];
    const metric  = parts[1];

    // detect operator in part[2]: gte/lte/gt/lt/eq/neq, else it's a threshold
    const OPERATORS = ["gte","lte","gt","lt","eq","neq"];
    let operator, threshold;
    if (OPERATORS.includes(parts[2])) {
        operator  = parts[2];
        threshold = parseInt(parts[3], 10);
    } else {
        operator  = "gte";
        threshold = parseInt(parts[2], 10);
    }

    return {
        version: 1,
        _legacy: true,
        sources: [{ id: "value", _service: service, _metric: metric }],
        evaluate: { op: operator, left: "value", right: threshold },
    };
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function httpGet(url, headers) {
    const resp = await Functions.makeHttpRequest({ url, headers: headers || {}, timeout: 9000 });
    return resp;
}

// ── URL interpolation ────────────────────────────────────────────────────────

function interpolate(str) {
    return str
        .replace(/{accountId}/g,   accountId)
        .replace(/{startEpoch}/g,  String(startEpoch))
        .replace(/{endEpoch}/g,    String(endEpoch))
        .replace(/{startISO}/g,    startISO)
        .replace(/{endISO}/g,      endISO)
        .replace(/{participant}/g, participantAddr)
        .replace(/{secret\.(\w+)}/g, (_, name) => {
            const val = (secrets || {})[name];
            if (!val) throw new Error("Secret not found: " + name);
            return val;
        });
}

// ── Value extractor ──────────────────────────────────────────────────────────
// Supports: "data.total_count", "data.*.distance|sum", "items|count", etc.

function extract(data, path) {
    if (!path) return data;

    // split aggregation
    let aggFn = null;
    let dotPath = path;
    if (path.includes("|")) {
        const [p, fn] = path.split("|");
        dotPath = p;
        aggFn = fn;
    }

    // traverse dot path (support * wildcard)
    const parts = dotPath.split(".");
    let current = data;
    for (const part of parts) {
        if (current === null || current === undefined) return null;
        if (part === "*") {
            if (!Array.isArray(current)) return null;
            // will continue with array
        } else {
            current = Array.isArray(current)
                ? current.map(item => item[part])
                : current[part];
        }
    }

    // flatten one level if nested arrays
    if (Array.isArray(current) && current.length > 0 && Array.isArray(current[0])) {
        current = current.flat();
    }

    if (!aggFn) return current;

    const nums = (Array.isArray(current) ? current : [current])
        .map(Number)
        .filter(n => !isNaN(n));

    switch (aggFn) {
        case "sum":   return nums.reduce((a, b) => a + b, 0);
        case "count": return Array.isArray(current) ? current.length : (current !== null && current !== undefined ? 1 : 0);
        case "avg":   return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case "max":   return nums.length ? Math.max(...nums) : 0;
        case "min":   return nums.length ? Math.min(...nums) : 0;
        case "first": return nums[0] ?? 0;
        case "last":  return nums[nums.length - 1] ?? 0;
        default:      return current;
    }
}

// ── Source executors ─────────────────────────────────────────────────────────

async function executeSource(src) {
    if (src._legacy) return executeLegacySource(src);

    if (src.type === "http" || !src.type) {
        const url = interpolate(src.url);

        // build headers
        const headers = {};
        if (src.headers) {
            for (const [k, v] of Object.entries(src.headers)) {
                headers[k] = interpolate(v);
            }
        }
        // shorthand auth
        if (src.auth) {
            const authVal = interpolate(src.auth);
            if (authVal.startsWith("bearer:")) {
                headers["Authorization"] = "Bearer " + authVal.slice(7);
            } else if (authVal.startsWith("token:")) {
                headers["Authorization"] = "token " + authVal.slice(6);
            } else if (authVal.startsWith("apikey:")) {
                headers["X-Api-Key"] = authVal.slice(7);
            }
        }

        const resp = await httpGet(url, headers);
        if (resp.error) throw new Error("HTTP error for source " + src.id + ": " + resp.error);
        if (resp.status && resp.status >= 400) throw new Error("HTTP " + resp.status + " for source " + src.id);

        let value = extract(resp.data, src.extract);
        if ((value === null || value === undefined) && src.extractAlt) {
            value = extract(resp.data, src.extractAlt);
        }
        return value;
    }

    throw new Error("Unknown source type: " + src.type);
}

// ── Legacy source executors ──────────────────────────────────────────────────

async function executeLegacySource(src) {
    const service = src._service;
    const metric  = src._metric;

    if (service === "github") {
        return executeGitHub(metric);
    }
    if (service === "strava") {
        return executeStrava(metric);
    }
    if (service === "chess") {
        return executeChess(metric);
    }
    if (service === "lichess") {
        return executeLichess(metric);
    }
    if (service === "leetcode") {
        return executeLeetCode(metric);
    }
    if (service === "duolingo") {
        return executeDuolingo(metric);
    }
    if (service === "codeforces") {
        return executeCodeforces(metric);
    }
    if (service === "coingecko") {
        return executeCoinGecko(metric);
    }
    throw new Error("Unknown legacy service: " + service);
}

async function executeGitHub(metric) {
    if (!accountId) throw new Error("bindAccount() not called — GitHub username missing");
    const headers = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (secrets && secrets.githubToken) headers["Authorization"] = "Bearer " + secrets.githubToken;

    if (metric === "commits") {
        const q = "author:" + accountId + "+author-date:" + startISO + ".." + endISO;
        const r = await httpGet("https://api.github.com/search/commits?q=" + q + "&per_page=1", headers);
        if (r.error || r.status !== 200) throw new Error("GitHub commits error");
        return r.data.total_count;
    }
    if (metric === "push_events" || metric === "pushes") {
        let count = 0;
        for (let page = 1; page <= 3; page++) {
            const r = await httpGet("https://api.github.com/users/" + accountId + "/events?per_page=100&page=" + page, headers);
            if (r.error || r.status !== 200) break;
            const events = r.data;
            if (!Array.isArray(events) || events.length === 0) break;
            let pastWindow = false;
            for (const e of events) {
                const ts = Math.floor(new Date(e.created_at).getTime() / 1000);
                if (ts < startEpoch) { pastWindow = true; break; }
                if (e.type === "PushEvent" && ts <= endEpoch) count++;
            }
            if (pastWindow || events.length < 100) break;
        }
        return count;
    }
    if (metric === "prs_merged") {
        const q = "is:pr+is:merged+author:" + accountId + "+merged:" + startISO + ".." + endISO;
        const r = await httpGet("https://api.github.com/search/issues?q=" + q + "&per_page=1", headers);
        if (r.error || r.status !== 200) throw new Error("GitHub PRs error");
        return r.data.total_count;
    }
    if (metric === "issues_closed") {
        const q = "is:issue+is:closed+author:" + accountId + "+closed:" + startISO + ".." + endISO;
        const r = await httpGet("https://api.github.com/search/issues?q=" + q + "&per_page=1", headers);
        if (r.error || r.status !== 200) throw new Error("GitHub issues error");
        return r.data.total_count;
    }
    if (metric === "stars") {
        // stars received on all user repos — get total stargazers
        const r = await httpGet("https://api.github.com/users/" + accountId + "/repos?per_page=100", headers);
        if (r.error || r.status !== 200) throw new Error("GitHub repos error");
        return (r.data || []).reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    }
    throw new Error("Unknown GitHub metric: " + metric);
}

async function executeStrava(metric) {
    const token = (secrets && secrets.stravaToken) || accountId;
    if (!token) throw new Error("Strava token missing");
    const headers = { "Authorization": "Bearer " + token };
    const base = "https://www.strava.com/api/v3/athlete/activities?after=" + startEpoch + "&before=" + endEpoch + "&per_page=100";
    let totalCount = 0, totalMeters = 0;
    for (let page = 1; page <= 5; page++) {
        const r = await httpGet(base + "&page=" + page, headers);
        if (r.error || r.status === 401) throw new Error("Strava token invalid");
        if (r.status !== 200) break;
        const acts = r.data;
        if (!Array.isArray(acts) || acts.length === 0) break;
        const runs = (metric === "runs" || metric === "distance") ? acts.filter(a => a.type === "Run") : acts;
        totalCount  += runs.length;
        totalMeters += runs.reduce((s, a) => s + (a.distance || 0), 0);
        if (acts.length < 100) break;
    }
    return metric === "distance" ? totalMeters : totalCount;
}

async function executeChess(metric) {
    if (!accountId) throw new Error("Chess.com username missing");
    const r = await httpGet("https://api.chess.com/pub/player/" + accountId + "/stats");
    if (r.error || r.status !== 200) throw new Error("Chess.com error");
    if (metric === "rapid_rating") return r.data.chess_rapid?.last?.rating || 0;
    if (metric === "blitz_rating") return r.data.chess_blitz?.last?.rating || 0;
    if (metric === "bullet_rating") return r.data.chess_bullet?.last?.rating || 0;
    if (metric === "puzzle_rating") return r.data.tactics?.highest?.rating || 0;
    throw new Error("Unknown Chess metric: " + metric);
}

async function executeLichess(metric) {
    if (!accountId) throw new Error("Lichess username missing");
    const r = await httpGet("https://lichess.org/api/user/" + accountId);
    if (r.error || r.status !== 200) throw new Error("Lichess error");
    if (metric === "rapid_rating")  return r.data.perfs?.rapid?.rating  || 0;
    if (metric === "blitz_rating")  return r.data.perfs?.blitz?.rating  || 0;
    if (metric === "bullet_rating") return r.data.perfs?.bullet?.rating || 0;
    if (metric === "puzzle_rating") return r.data.perfs?.puzzle?.rating || 0;
    if (metric === "games_played")  return r.data.count?.all || 0;
    throw new Error("Unknown Lichess metric: " + metric);
}

async function executeLeetCode(metric) {
    if (!accountId) throw new Error("LeetCode username missing");
    const r = await httpGet("https://leetcode-stats-api.herokuapp.com/" + accountId);
    if (r.error || r.status !== 200) throw new Error("LeetCode error");
    if (metric === "problems_solved") return r.data.totalSolved || 0;
    if (metric === "easy_solved")     return r.data.easySolved  || 0;
    if (metric === "medium_solved")   return r.data.mediumSolved|| 0;
    if (metric === "hard_solved")     return r.data.hardSolved  || 0;
    if (metric === "ranking")         return r.data.ranking     || 999999;
    if (metric === "acceptance_rate") return parseFloat(r.data.acceptanceRate) || 0;
    throw new Error("Unknown LeetCode metric: " + metric);
}

async function executeDuolingo(metric) {
    if (!accountId) throw new Error("Duolingo username missing");
    const r = await httpGet("https://duolingo.com/2017-06-30/users?username=" + accountId);
    if (r.error || r.status !== 200) throw new Error("Duolingo error");
    const user = r.data.users && r.data.users[0];
    if (!user) throw new Error("Duolingo user not found");
    if (metric === "streak")    return user.streak          || 0;
    if (metric === "xp_total")  return user.totalXp         || 0;
    if (metric === "xp_month")  return user.monthlyXp       || 0;
    if (metric === "followers")  return user.totalFollowers  || 0;
    throw new Error("Unknown Duolingo metric: " + metric);
}

async function executeCodeforces(metric) {
    if (!accountId) throw new Error("Codeforces handle missing");
    const r = await httpGet("https://codeforces.com/api/user.info?handles=" + accountId);
    if (r.error || r.status !== 200 || r.data.status !== "OK") throw new Error("Codeforces error");
    const user = r.data.result[0];
    if (metric === "rating")      return user.rating    || 0;
    if (metric === "max_rating")  return user.maxRating || 0;
    if (metric === "rank")        return user.rank === "newbie" ? 0 : 1; // 0=fail, 1=pass for rank check
    throw new Error("Unknown Codeforces metric: " + metric);
}

async function executeCoinGecko(metric) {
    // metric format: "price:bitcoin" or "price:ethereum"
    const [type, coinId] = metric.split(":");
    if (type === "price") {
        const r = await httpGet("https://api.coingecko.com/api/v3/simple/price?ids=" + coinId + "&vs_currencies=usd");
        if (r.error || r.status !== 200) throw new Error("CoinGecko error");
        return r.data[coinId]?.usd || 0;
    }
    throw new Error("Unknown CoinGecko metric: " + metric);
}

// ── Expression evaluator ─────────────────────────────────────────────────────

function evaluate(node, values) {
    const op = node.op;

    // Compound
    if (op === "AND") return node.conditions.every(c => evaluate(c, values));
    if (op === "OR")  return node.conditions.some(c  => evaluate(c, values));
    if (op === "NOT") return !evaluate(node.condition, values);

    // Resolve left/right
    const left  = typeof node.left  === "string" ? (values[node.left]  ?? node.left)  : node.left;
    const right = typeof node.right === "string" ? (values[node.right] ?? node.right) : node.right;

    const l = Number(left);
    const r = Number(right);

    switch (op) {
        case "gte":     return l >= r;
        case "lte":     return l <= r;
        case "gt":      return l > r;
        case "lt":      return l < r;
        case "eq":      return l === r || String(left) === String(right);
        case "neq":     return l !== r;
        case "between": return l >= r && l <= Number(node.max);
        case "exists":  return left !== null && left !== undefined && left !== "";
        case "pct_gte": {
            // percentage change: (current - baseline) / baseline * 100 >= threshold
            const baseline = Number(values[node.baseline] || node.baselineValue || 0);
            if (baseline === 0) return false;
            return ((l - baseline) / baseline * 100) >= r;
        }
        default:
            throw new Error("Unknown operator: " + op);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const criteria = await loadCriteria(criteriaRaw);

    // Execute all sources
    const values = {};
    for (const src of (criteria.sources || [])) {
        values[src.id] = await executeSource(src);
    }

    // Evaluate expression tree
    const passed = evaluate(criteria.evaluate, values);
    return Functions.encodeUint256(passed ? 1 : 0);
}

return main();
