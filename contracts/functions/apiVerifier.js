// Chainlink Functions source for ApiOracleVerifier
//
// args[0]: criteria — "<service>:<metric>:<threshold>:<startEpoch>:<endEpoch>"
//            service  : "github" | "strava"
//            metric   : github → "commits" | "push_events"
//                       strava → "runs" | "distance" (threshold in metres)
// args[1]: serviceAccountId — GitHub username, or Strava access token
//
// secrets.githubToken — (optional) GitHub PAT; raises rate-limit from 10 → 30 req/min
// secrets.stravaToken — (optional) overrides args[1] as the Strava access token
//
// Returns Functions.encodeUint256(1) for pass, Functions.encodeUint256(0) for fail.
// Throws on infrastructure / config errors so the DON marks the request errored
// and the contract owner can retry via retryVerification().

const parts = args[0].split(":");
if (parts.length !== 5) throw new Error("criteria must be service:metric:threshold:startEpoch:endEpoch");

const [service, metric, thresholdStr, startStr, endStr] = parts;
const serviceAccountId = args[1];

const threshold  = parseInt(thresholdStr, 10);
const startEpoch = parseInt(startStr, 10);
const endEpoch   = parseInt(endStr,   10);

if (isNaN(threshold) || threshold <= 0)   throw new Error("Invalid threshold");
if (isNaN(startEpoch) || isNaN(endEpoch)) throw new Error("Invalid epoch timestamps");
if (startEpoch >= endEpoch)               throw new Error("startEpoch must precede endEpoch");
// Convert Unix epoch → full ISO 8601 timestamp (GitHub search accepts second-level precision)
const toIso = (epoch) => new Date(epoch * 1000).toISOString();

// ── GitHub ────────────────────────────────────────────────────────────────────
if (service === "github") {
    if (!serviceAccountId) throw new Error("serviceAccountId is empty — did the participant call bindAccount()?");
    const headers = {
        "Accept":               "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if (secrets.githubToken) headers["Authorization"] = `Bearer ${secrets.githubToken}`;

    if (metric === "commits") {
        // GitHub search/commits counts all commits authored by the user in the date window.
        const q    = `author:${serviceAccountId}+author-date:${toIso(startEpoch)}..${toIso(endEpoch)}`;
        const resp = await Functions.makeHttpRequest({
            url:     `https://api.github.com/search/commits?q=${q}&per_page=1`,
            headers,
            timeout: 10_000,
        });
        if (resp.error)      throw new Error(`GitHub API error: ${resp.error}`);
        if (resp.status !== 200) throw new Error(`GitHub returned HTTP ${resp.status}`);

        return Functions.encodeUint256(resp.data.total_count >= threshold ? 1 : 0);

    } else if (metric === "push_events") {
        // Events API: up to 300 events (3 pages of 100), max 90 days back.
        let pushCount = 0;
        for (let page = 1; page <= 3; page++) {
            const resp = await Functions.makeHttpRequest({
                url:     `https://api.github.com/users/${serviceAccountId}/events?per_page=100&page=${page}`,
                headers,
                timeout: 10_000,
            });
            if (resp.error)       throw new Error(`GitHub events error: ${resp.error}`);
            if (resp.status !== 200) throw new Error(`GitHub returned HTTP ${resp.status}`);

            const events = resp.data;
            if (!Array.isArray(events) || events.length === 0) break;

            let pastWindow = false;
            for (const e of events) {
                const ts = Math.floor(new Date(e.created_at).getTime() / 1000);
                if (ts < startEpoch) { pastWindow = true; break; } // events are newest-first
                if (e.type === "PushEvent" && ts <= endEpoch) pushCount++;
            }
            if (pastWindow || events.length < 100) break;
        }
        return Functions.encodeUint256(pushCount >= threshold ? 1 : 0);

    } else {
        throw new Error(`Unknown GitHub metric: "${metric}" — supported: commits, push_events`);
    }
}

// ── Strava ────────────────────────────────────────────────────────────────────
if (service === "strava") {
    // The participant binds their Strava access token as serviceAccountId via bindAccount().
    // secrets.stravaToken can override this (e.g., a server-managed token for the dApp).
    const token   = secrets.stravaToken || serviceAccountId;
    if (!token) throw new Error("serviceAccountId is empty — did the participant call bindAccount()?");
    const headers = { "Authorization": `Bearer ${token}` };
    const baseUrl = `https://www.strava.com/api/v3/athlete/activities?after=${startEpoch}&before=${endEpoch}&per_page=100`;

    let totalCount  = 0;
    let totalMeters = 0;

    for (let page = 1; page <= 10; page++) {
        const resp = await Functions.makeHttpRequest({
            url:     `${baseUrl}&page=${page}`,
            headers,
            timeout: 10_000,
        });
        if (resp.error)          throw new Error(`Strava API error: ${resp.error}`);
        if (resp.status === 401) throw new Error("Strava token expired or invalid — participant must rebind account");
        if (resp.status !== 200) throw new Error(`Strava returned HTTP ${resp.status}`);

        const acts = resp.data;
        if (!Array.isArray(acts) || acts.length === 0) break;

        const runs = (metric === "runs" || metric === "distance")
            ? acts.filter(a => a.type === "Run")
            : acts; // "activities" counts all types

        totalCount  += runs.length;
        totalMeters += runs.reduce((sum, a) => sum + (a.distance || 0), 0);
        if (acts.length < 100) break;
    }

    if (metric === "distance") {
        return Functions.encodeUint256(totalMeters >= threshold ? 1 : 0);
    }
    if (metric === "runs" || metric === "activities") {
        return Functions.encodeUint256(totalCount >= threshold ? 1 : 0);
    }
    throw new Error(`Unknown Strava metric: "${metric}" — supported: runs, distance, activities`);
}

throw new Error(`Unknown service: "${service}" — supported: github, strava`);
