# T&C Radar — Chrome Web Store Listing Copy

## Short description (132 char limit)
Reads Terms & Conditions pages with AI and warns you what you're accepting — before you click Accept.

## Detailed description
You click "I Agree" dozens of times a year. Nobody reads the terms. T&C Radar reads them for you.

HOW IT WORKS
• Automatically detects Terms of Service, Privacy Policy, and consent pages as you browse
• Finds "Accept" / "Agree" / "Allow all" buttons and intercepts your first click so you can see the warning first
• Sends the page text to the DeepSeek AI model and shows a plain-English breakdown within seconds

WHAT YOU SEE
• A consumer risk score (low / medium / high) computed from a fixed, transparent scoring rubric — not an AI's gut feeling
• Rubric breakdown by category: dispute resolution, data rights, content licensing, billing traps, unilateral changes, liability, jurisdiction — each backed by the actual quoted clause
• Top flagged clauses: forced arbitration, class action waivers, selling your data, auto-renewal traps, terms that change without notice, and more

DETERMINISTIC SCORING
Every agreement is scored against the same published rubric. Points are awarded only for clauses explicitly quoted from the document. Same terms, same score — every time.

PRIVACY-FIRST
• No account, no analytics, no telemetry
• Your API key stays in your browser
• Page text is sent to the DeepSeek API only when a scan runs, and only for the page being scanned
• Results are cached locally so repeat visits cost nothing

T&C Radar requires a DeepSeek API key (platform.deepseek.com). API usage is pay-as-you-go; a typical scan costs a fraction of a cent.

## Category
Productivity

## Permission justifications (for the Privacy practices tab)
- storage: Stores the user's DeepSeek API key and cached analysis results locally in the browser.
- activeTab: Extracts page text only when the user explicitly clicks "Scan this page" in the extension popup.
- scripting: Used together with activeTab to read the current page's text on manual scan.
- Host permissions (all URLs): The extension must detect terms/consent pages and intercept accept-button clicks on any website the user visits; terms pages have no predictable URL pattern, so a broad host permission is required. Page content is transmitted only to the DeepSeek API at scan time and nowhere else.

## Data usage disclosures (check these in the dashboard)
- Collects or uses: website content (page text of scanned pages)
- Not used for: ad personalization, creditworthiness, sale to third parties
- Transfer: page text sent to DeepSeek API (third party) solely to provide the analysis
- Handles personal/sensitive info: NO (page text of legal documents; not user-personal data — answer per your judgment)

## Privacy policy URL
Host privacy-policy.html anywhere public (GitHub Pages, your site) and paste the URL.

## Screenshots needed (1280x800)
1. Banner on a ToS page showing HIGH risk + score bar
2. Rubric breakdown expanded with evidence quotes
3. Accept-button interception (orange outline on Accept All)

## Small promo tile (440x280)
icons/preview.png is 512x512 — crop/pad to 440x280 or reuse as-is; CWS also accepts the 128 icon scaled.
