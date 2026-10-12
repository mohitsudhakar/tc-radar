# T&C Radar

Chrome extension (MV3) that reads Terms & Conditions / Privacy Policy pages and warns you what you're actually accepting — powered by DeepSeek (default model: `deepseek-flash`).

## What it does

1. Auto-detects ToS/privacy pages (URL, title, headings) and scans them on visit.
2. Finds "Accept / Agree / Allow all"-style buttons on any page and outlines them.
3. First click on an accept button is intercepted — the analysis banner pops up instead. Second click goes through.
4. Scores the agreement against a fixed consumer-protection rubric (see below) and shows: risk score bar, rubric breakdown with quoted evidence, and top flagged clauses.
5. Manual "Scan this page" from the toolbar popup.

## The rubric (deterministic scoring)

Risk level is a function of a numeric score, not the model's vibe. Points are awarded only for clauses explicitly present in the document, each backed by a quoted excerpt:

| Category | Clause | Points |
|---|---|---|
| Dispute Resolution | Mandatory binding arbitration | +2 |
| | Class action / jury trial waiver | +2 |
| | Small-claims or opt-out carve-out | -1 |
| Data Rights | Data sold/shared for ads/profiling | +3 |
| | Data used beyond the service (model training, cross-site tracking) | +2 |
| | Retained after account deletion | +1 |
| Content & IP | Broad/perpetual/irrevocable license to user content | +2 |
| Financial | Auto-renewal + difficult cancellation | +2 |
| | Unilateral price changes | +1 |
| | No-refund digital goods | +1 |
| Unilateral Power | Terms change anytime without notice | +2 |
| | Termination at sole discretion, no appeal | +1 |
| Liability | Broad "as is" liability waiver | +1 |
| | User indemnifies the company | +2 |
| Jurisdiction | Consumer-unfavorable governing law/venue | +1 |

Risk level: 0-2 low, 3-6 medium, 7+ high. Temperature is pinned to 0 so the same document scores the same way every time.

## Install

1. Chrome -> `chrome://extensions` -> enable Developer mode.
2. "Load unpacked" -> select this folder.
3. Click the puzzle icon -> T&C Radar -> "Settings (API key)" and paste your DeepSeek API key (platform.deepseek.com).
4. Optionally change the model (defaults to `deepseek-flash`).

## Files

- `manifest.json` — MV3 manifest
- `background.js` — service worker; calls DeepSeek chat completions API, returns structured JSON risk analysis
- `content.js` — page detection, text extraction, accept-button interception, banner UI
- `overlay.css` — banner styles
- `popup.html/js` — manual scan + link to settings
- `options.html/js` — API key, model, auto-scan toggle

## Privacy

Page text (first ~12k chars) is sent to DeepSeek only when a scan runs. Nothing is stored server-side by the extension; the API key lives in Chrome sync storage.
