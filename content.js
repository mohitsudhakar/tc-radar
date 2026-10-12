// T&C Radar — content script
// 1. Detects ToS/privacy pages + accept/consent buttons on any page.
// 2. Extracts document text, sends to background for DeepSeek analysis.
// 3. Shows a warning banner; intercepts "accept"-style clicks until the user has seen the warning.

(() => {
  if (window.__tcRadarLoaded) return;
  window.__tcRadarLoaded = true;

  const TOS_URL_HINTS = /terms|tos|conditions|privacy|policy|eula|legal|agreement|consent/i;
  const ACCEPT_TEXT = /^(i )?(accept|agree|acknowledge|consent|continue|got it|ok(ay)?|allow all|accept all)/i;

  let banner = null;
  let analyzing = false;
  let scannedUrl = null; // don't auto-rescan a URL we've already shown results for

  // ---------- helpers ----------

  function looksLikeTosPage() {
    const url = location.href;
    const title = document.title || "";
    if (TOS_URL_HINTS.test(url) || TOS_URL_HINTS.test(title)) return true;
    // pages dominated by legal-ish headings
    const headings = Array.from(document.querySelectorAll("h1,h2"))
      .slice(0, 6)
      .map((h) => h.textContent || "")
      .join(" ");
    return TOS_URL_HINTS.test(headings);
  }

  function findAcceptButtons() {
    const els = Array.from(
      document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')
    );
    return els.filter((el) => {
      const label = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();
      return label.length > 0 && label.length < 40 && ACCEPT_TEXT.test(label);
    });
  }

  function extractText() {
    // Prefer the largest legal-looking container; fallback to body text
    const candidates = Array.from(
      document.querySelectorAll("main, article, [class*='term'], [id*='term'], [class*='policy'], [id*='policy'], [class*='legal'], [class*='consent'], [class*='privacy']")
    );
    let best = null;
    for (const c of candidates) {
      const t = (c.innerText || "").trim();
      if (t.length > (best ? (best.innerText || "").trim().length : 0)) best = c;
    }
    const text = ((best && best.innerText) || document.body.innerText || "").trim();
    return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  // ---------- banner ----------

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "tc-radar-banner";
    banner.innerHTML = `
      <div class="tcr-row">
        <span class="tcr-logo">⚖️ T&C Radar</span>
        <span class="tcr-status">Scanning this agreement…</span>
        <button class="tcr-close" title="Dismiss">×</button>
      </div>
      <div class="tcr-body" hidden></div>
    `;
    banner.querySelector(".tcr-close").addEventListener("click", () => {
      banner.remove();
      banner = null;
      releaseAcceptButtons();
    });
    document.documentElement.appendChild(banner);
    return banner;
  }

  function renderResult(result, fromCache) {
    if (!banner) return;
    const status = banner.querySelector(".tcr-status");
    const body = banner.querySelector(".tcr-body");
    const risk = (result.risk_level || "low").toLowerCase();
    const score = typeof result.score === "number" ? result.score : null;
    banner.dataset.risk = risk;

    status.textContent =
      (risk === "high" ? "⚠ High risk agreement"
      : risk === "medium" ? "Notable clauses found"
      : "Looks fairly standard") + (fromCache ? " · cached" : "");

    // score bar (0-12 visual cap)
    const cap = 12;
    const pct = score === null ? 0 : Math.min(100, Math.round((Math.max(0, score) / cap) * 100));
    const scoreHtml = score === null ? "" : `
      <div class="tcr-score">
        <div class="tcr-score-head">
          <span>Consumer risk score</span>
          <b>${score} / ${cap}+</b>
        </div>
        <div class="tcr-score-track">
          <div class="tcr-score-fill tcr-${risk}" style="width:${pct}%"></div>
          <span class="tcr-tick" style="left:${(3 / cap) * 100}%"></span>
          <span class="tcr-tick" style="left:${(7 / cap) * 100}%"></span>
        </div>
        <div class="tcr-score-labels"><span>low</span><span>medium</span><span>high</span></div>
      </div>`;

    const cats = (result.categories || [])
      .map((c) => {
        const pts = c.points > 0 ? `+${c.points}` : `${c.points}`;
        const ev = (c.evidence || [])
          .map((q) => `<div class="tcr-quote">"${escapeHtml(q)}"</div>`)
          .join("");
        return `
          <details class="tcr-cat">
            <summary><span class="tcr-cat-name">${escapeHtml(c.category)}</span><span class="tcr-cat-pts">${pts}</span></summary>
            ${ev || '<div class="tcr-quote tcr-none">no excerpt</div>'}
          </details>`;
      })
      .join("");

    const flags = (result.flags || [])
      .map((f) => {
        const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "ℹ️";
        return `<div class="tcr-flag tcr-sev-${f.severity}"><span class="tcr-flag-icon">${icon}</span><div><b>${escapeHtml(f.title)}</b><br>${escapeHtml(f.detail)}</div></div>`;
      })
      .join("");

    body.innerHTML = `
      ${scoreHtml}
      <p class="tcr-summary">${escapeHtml(result.summary || "")}</p>
      ${cats ? `<div class="tcr-section">Rubric breakdown <span class="tcr-hint">(click to see evidence)</span></div>${cats}` : ""}
      ${flags ? `<div class="tcr-section">Top clauses to know</div>${flags}` : ""}
    `;
    body.hidden = false;
  }

  function renderError(err) {
    if (!banner) return;
    banner.dataset.risk = "error";
    banner.querySelector(".tcr-status").textContent = "Scan unavailable";
    const body = banner.querySelector(".tcr-body");
    body.innerHTML = `<p class="tcr-summary">${escapeHtml(err)}</p>`;
    body.hidden = false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- accept-button interception ----------

  const armedButtons = new WeakSet();

  function armAcceptButtons() {
    for (const el of findAcceptButtons()) {
      if (armedButtons.has(el) || !isVisible(el)) continue;
      armedButtons.add(el);
      el.addEventListener("click", onAcceptClick, true); // capture phase
      el.classList.add("tcr-armed");
    }
  }

  function releaseAcceptButtons() {
    for (const el of findAcceptButtons()) {
      el.removeEventListener("click", onAcceptClick, true);
      el.classList.remove("tcr-armed");
    }
  }

  let userAcknowledged = false;

  function onAcceptClick(e) {
    if (userAcknowledged || analyzing) return; // let it through
    // First click: block, show analysis, mark acknowledged for next click
    e.stopPropagation();
    e.preventDefault();
    userAcknowledged = true;
    if (banner) {
      banner.classList.add("tcr-pulse");
      banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => banner && banner.classList.remove("tcr-pulse"), 1200);
    }
    triggerScan(false);
  }

  // ---------- scanning ----------

  async function triggerScan(isAuto) {
    if (analyzing) return;
    // Auto-scans: skip if we already showed results for this URL (cache hit or not).
    if (isAuto && scannedUrl === location.href) return;
    const text = extractText();
    if (text.length < 200) return;

    const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" }).catch(() => null);
    if (isAuto && settings && settings.settings && settings.settings.autoScan === false) return;

    analyzing = true;
    scannedUrl = location.href;
    ensureBanner();
    const response = await chrome.runtime
      .sendMessage({
        type: "ANALYZE_TOS",
        payload: { url: location.href, title: document.title, text },
      })
      .catch((err) => ({ ok: false, error: String(err) }));
    analyzing = false;

    if (!banner) return; // user closed it mid-scan
    if (response && response.ok) renderResult(response.result, !!response.cached);
    else renderError((response && response.error) || "Unknown error");
  }

  // ---------- boot ----------

  function boot() {
    const tosPage = looksLikeTosPage();
    const acceptBtns = findAcceptButtons().filter(isVisible);

    if (tosPage) {
      triggerScan(true);
    }
    if (acceptBtns.length > 0) {
      armAcceptButtons();
      // If there are accept buttons and the page also contains legal text, pre-scan quietly
      if (tosPage || TOS_URL_HINTS.test(document.body.innerText.slice(0, 3000))) {
        triggerScan(true);
      }
    }

    // SPA / lazy content: re-check occasionally for new consent dialogs
    let checks = 0;
    const iv = setInterval(() => {
      checks++;
      if (checks > 20 || !banner && !document.body) return clearInterval(iv);
      armAcceptButtons();
    }, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
