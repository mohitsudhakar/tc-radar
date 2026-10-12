// T&C Radar — background service worker
// Calls DeepSeek (default model: deepseek-flash) and returns a structured risk analysis.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4.1-flash";

const SYSTEM_PROMPT = `You are a consumer-protection analyst running a FIXED evaluation rubric. You read website Terms & Conditions / Terms of Service / Privacy Policies and score them against the rubric below. Consistency is paramount: given the same document, you must always reach the same verdict.

EVALUATION RUBRIC — check each category, in this exact order:

1. DISPUTE RESOLUTION
   - Is there mandatory binding arbitration? (+2)
   - Is there a class action / jury trial waiver? (+2)
   - Is there a small-claims or 30-day opt-out carve-out? (-1)

2. DATA RIGHTS
   - Is personal data sold or shared with third parties for advertising/profiling? (+3)
   - Is data used for purposes beyond providing the service (e.g. training models, cross-site tracking)? (+2)
   - Is data retained after account deletion? (+1)

3. CONTENT & IP
   - Does the company take a broad/perpetual/irrevocable license to user content? (+2)
   - Is the license limited to operating the service? (+0)

4. FINANCIAL
   - Auto-renewal with difficult cancellation (call-to-cancel, dark patterns)? (+2)
   - Unilateral price changes? (+1)
   - No-refund policy on digital goods? (+1)

5. UNILATERAL POWER
   - Can terms change at any time without notice? (+2)
   - Can the company terminate/suspend accounts at sole discretion without cause or appeal? (+1)

6. LIABILITY
   - Broad liability waiver / "as is" disclaimer? (+1)
   - User must indemnify the company? (+2)

7. JURISDICTION
   - Governing law / venue in a forum unfavorable or distant to typical consumers? (+1)

RISK LEVEL = f(total score):
   0-2   -> "low"
   3-6   -> "medium"
   7+    -> "high"

Only score a category when the document EXPLICITLY contains the clause — never infer or assume. Quote the clause (short excerpt) as evidence for every point you award.

Return ONLY valid JSON (no markdown fences, no preamble) with this exact shape:
{
  "summary": "2-3 sentence plain-English summary of the agreement",
  "risk_level": "low" | "medium" | "high",
  "score": <integer total>,
  "categories": [
    { "category": "Dispute Resolution", "points": <int>, "evidence": ["short quote 1", "short quote 2"] }
  ],
  "flags": [
    { "severity": "info" | "warning" | "critical", "title": "short title", "detail": "one sentence plain-English explanation" }
  ]
}

Rules:
- Include only categories with non-zero points, in rubric order.
- flags: top 8 most consumer-relevant items, severity critical (score contribution >= 2), warning (1), info (context).
- If the text is not a terms/policy document, return {"summary":"Not a terms document","risk_level":"low","score":0,"categories":[],"flags":[]}.`;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_TOS") {
    analyze(msg.payload).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    });
    return true; // async
  }
  if (msg.type === "GET_SETTINGS") {
    chrome.storage.sync.get(["apiKey", "model", "autoScan"], (s) => {
      sendResponse({
        ok: true,
        settings: {
          apiKey: s.apiKey || "",
          model: s.model || DEFAULT_MODEL,
          autoScan: s.autoScan !== false,
        },
      });
    });
    return true;
  }
});

async function analyze({ url, title, text }) {
  const { apiKey, model } = await new Promise((r) =>
    chrome.storage.sync.get(["apiKey", "model"], r)
  );
  if (!apiKey) {
    return { ok: false, error: "No API key set. Open the extension options to add your DeepSeek API key." };
  }

  // Trim to ~12k chars to stay well inside context + keep cost low
  const trimmed = (text || "").slice(0, 12000);
  if (trimmed.length < 200) {
    return { ok: false, error: "Not enough text extracted from the page to analyze." };
  }

  // Cache: keyed by URL + content fingerprint. Hit => return instantly, no API call.
  const cacheKey = "cache:" + (url || "") + ":" + String(len32(trimmed)) + ":" + String(hash32(trimmed));
  const cached = await new Promise((r) => chrome.storage.local.get([cacheKey], r));
  if (cached && cached[cacheKey] && cached[cacheKey].result) {
    return { ok: true, result: cached[cacheKey].result, cached: true };
  }

  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Page: ${title || ""} (${url})\n\n--- DOCUMENT TEXT ---\n${trimmed}`,
      },
    ],
    temperature: 0,
    max_tokens: 4096,
  };

  const resp = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `DeepSeek API ${resp.status}: ${errText.slice(0, 300)}` };
  }

  const data = await resp.json();
  const msg = data.choices?.[0]?.message || {};
  const raw = msg.content || "";
  if (!raw.trim()) {
    const reason = data.choices?.[0]?.finish_reason || "unknown";
    return { ok: false, error: `Empty model output (finish_reason=${reason}, model=${body.model}). Reasoning: ${String(msg.reasoning_content || "").slice(0, 150)}` };
  }
  const parsed = parseModelJson(raw);
  if (!parsed) {
    return { ok: false, error: "Model returned unusable output: " + raw.slice(0, 200) };
  }
  // Store in cache (fire and forget; prune old entries opportunistically)
  chrome.storage.local.set({ [cacheKey]: { result: parsed, ts: Date.now() } }, pruneCache);
  return { ok: true, result: parsed, usage: data.usage || null };
}

// FNV-1a 32-bit hash — cheap content fingerprint for cache keys.
function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
function len32(s) { return s.length; }

// Keep at most 100 cached analyses, evicting oldest.
function pruneCache() {
  chrome.storage.local.get(null, (all) => {
    const keys = Object.keys(all).filter((k) => k.startsWith("cache:"));
    if (keys.length <= 100) return;
    const sorted = keys
      .map((k) => [k, (all[k] && all[k].ts) || 0])
      .sort((a, b) => a[1] - b[1]);
    const toRemove = sorted.slice(0, keys.length - 100).map(([k]) => k);
    chrome.storage.local.remove(toRemove);
  });
}

// Tolerant extraction: strip markdown fences, grab the outermost {...},
// and attempt to repair truncated JSON (cut-off strings/arrays/objects).
function parseModelJson(raw) {
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  if (start === -1) return null;
  s = s.slice(start);

  // 1) direct parse
  try { return JSON.parse(s); } catch (_) {}

  // 2) repair truncation: balance quotes, drop incomplete trailing entries, close structures
  let t = s;
  // close an unterminated string (odd number of unescaped quotes)
  if (((t.match(/(?<!\\)"/g) || []).length) % 2 === 1) t += '"';

  // iteratively drop a trailing incomplete item: ", key: value" or ", {...}" with unbalanced braces
  for (let i = 0; i < 10; i++) {
    try { return JSON.parse(closeOpen(t)); } catch (_) {}
    const m = t.match(/,\s*((?:"(?:[^"\\]|\\.)*"\s*:\s*)?.*)$/s);
    if (!m || m.index === undefined) break;
    t = t.slice(0, m.index);
  }
  try { return JSON.parse(closeOpen(t)); } catch (_) {}
  return null;

  function closeOpen(x) {
    x = x.replace(/,\s*$/, "").replace(/:\s*$/, ": null");
    const stack = [];
    let inStr = false, esc = false;
    for (const ch of x) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
    return x + stack.reverse().join("");
  }
}
