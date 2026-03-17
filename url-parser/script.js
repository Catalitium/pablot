(function () {
  const urlInput = document.getElementById("urlInput");
  const parseBtn = document.getElementById("parseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorEl = document.getElementById("error");
  const queryBody = document.getElementById("queryBody");

  const fields = {
    schemeValue: document.getElementById("schemeValue"),
    usernameValue: document.getElementById("usernameValue"),
    passwordFlagValue: document.getElementById("passwordFlagValue"),
    hostValue: document.getElementById("hostValue"),
    portValue: document.getElementById("portValue"),
    pathnameValue: document.getElementById("pathnameValue"),
    searchValue: document.getElementById("searchValue"),
    fragmentValue: document.getElementById("fragmentValue")
  };

  function placeholder(value) {
    return value && value.length > 0 ? value : "(none)";
  }

  function clearOutput() {
    fields.schemeValue.textContent = "(none)";
    fields.usernameValue.textContent = "(none)";
    fields.passwordFlagValue.textContent = "No";
    fields.hostValue.textContent = "(none)";
    fields.portValue.textContent = "(none)";
    fields.pathnameValue.textContent = "(none)";
    fields.searchValue.textContent = "(none)";
    fields.fragmentValue.textContent = "(none)";
    queryBody.innerHTML = "";
  }

  function setError(message) {
    errorEl.textContent = message;
    errorEl.classList.toggle("active", Boolean(message));
  }

  function renderQuery(searchParams) {
    queryBody.innerHTML = "";
    const entries = Array.from(searchParams.entries());
    if (entries.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = "<td colspan=\"2\">(none)</td>";
      queryBody.appendChild(row);
      return;
    }
    entries.forEach(([key, value]) => {
      const row = document.createElement("tr");
      const keyCell = document.createElement("td");
      const valueCell = document.createElement("td");
      keyCell.textContent = key;
      valueCell.textContent = value;
      row.appendChild(keyCell);
      row.appendChild(valueCell);
      queryBody.appendChild(row);
    });
  }

  function parse() {
    const input = urlInput.value.trim();
    if (!input) {
      clearOutput();
      setError("Enter a URL to parse.");
      return;
    }

    try {
      const parsed = new URL(input);
      fields.schemeValue.textContent = placeholder(parsed.protocol.replace(":", ""));
      fields.usernameValue.textContent = placeholder(parsed.username);
      fields.passwordFlagValue.textContent = parsed.password ? "Yes" : "No";
      fields.hostValue.textContent = placeholder(parsed.host || parsed.hostname);
      fields.portValue.textContent = placeholder(parsed.port);
      fields.pathnameValue.textContent = placeholder(parsed.pathname);
      fields.searchValue.textContent = placeholder(parsed.search);
      fields.fragmentValue.textContent = placeholder(parsed.hash);
      renderQuery(parsed.searchParams);
      setError("");
    } catch (error) {
      clearOutput();
      setError("Invalid URL. Enter a full URL like https://example.com/path?x=1.");
    }
  }

  parseBtn.addEventListener("click", parse);
  resetBtn.addEventListener("click", () => {
    urlInput.value = "";
    clearOutput();
    setError("");
  });

  clearOutput();
})();
