const DEFAULT_MODEL = "deepseek-v4.1-flash";

chrome.storage.sync.get(["apiKey", "model", "autoScan"], (s) => {
  document.getElementById("apiKey").value = s.apiKey || "";
  document.getElementById("model").value = s.model || DEFAULT_MODEL;
  document.getElementById("autoScan").checked = s.autoScan !== false;
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      apiKey: document.getElementById("apiKey").value.trim(),
      model: document.getElementById("model").value.trim() || DEFAULT_MODEL,
      autoScan: document.getElementById("autoScan").checked,
    },
    () => {
      const msg = document.getElementById("msg");
      msg.textContent = "Saved.";
      setTimeout(() => (msg.textContent = ""), 2000);
    }
  );
});
