const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

document.getElementById("scan").addEventListener("click", async () => {
  statusEl.textContent = "Scanning…";
  resultsEl.innerHTML = "";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { statusEl.textContent = "No active tab."; return; }

  const [{ result: text }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.slice(0, 12000),
  });

  if (!text || text.length < 200) {
    statusEl.textContent = "Not enough text on this page.";
    return;
  }

  const resp = await chrome.runtime.sendMessage({
    type: "ANALYZE_TOS",
    payload: { url: tab.url, title: tab.title, text },
  });

  if (resp && resp.ok) {
    statusEl.textContent = resp.cached ? "Loaded from cache — no API call." : "";
    renderResult(resp.result);
  } else {
    statusEl.textContent = "Error: " + ((resp && resp.error) || "unknown");
  }
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderResult(r) {
  const risk = (r.risk_level || "low").toLowerCase();
  const score = typeof r.score === "number" ? r.score : null;
  const cap = 12;
  const pct = score === null ? 0 : Math.min(100, Math.round((Math.max(0, score) / cap) * 100));

  const cats = (r.categories || [])
    .map((c) => {
      const pts = c.points > 0 ? `+${c.points}` : `${c.points}`;
      const ev = (c.evidence || []).map((q) => `<div class="quote">"${esc(q)}"</div>`).join("");
      return `<details class="cat"><summary><span>${esc(c.category)}</span><b class="pts">${pts}</b></summary>${ev}</details>`;
    })
    .join("");

  const flags = (r.flags || [])
    .map((f) => {
      const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "ℹ️";
      return `<div class="flag">${icon} <b>${esc(f.title)}</b><br><span class="detail">${esc(f.detail)}</span></div>`;
    })
    .join("");

  resultsEl.innerHTML = `
    <div class="verdict ${risk}">
      <span class="risk-label">${risk.toUpperCase()} RISK</span>
      ${score !== null ? `<span class="score">${score} pts</span>` : ""}
    </div>
    <div class="track"><div class="fill ${risk}" style="width:${pct}%"></div></div>
    <p class="summary">${esc(r.summary || "")}</p>
    ${cats ? `<div class="section">Rubric breakdown</div>${cats}` : ""}
    ${flags ? `<div class="section">Top clauses</div>${flags}` : ""}
  `;
}
