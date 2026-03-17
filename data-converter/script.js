(function () {
  const sourceFormatEl = document.getElementById("sourceFormat");
  const targetFormatEl = document.getElementById("targetFormat");
  const inputTextEl = document.getElementById("inputText");
  const outputTextEl = document.getElementById("outputText");
  const convertBtn = document.getElementById("convertBtn");
  const swapBtn = document.getElementById("swapBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const messageEl = document.getElementById("message");
  const errorEl = document.getElementById("error");

  const extensions = { csv: "csv", json: "json", yaml: "yaml" };

  function setMessage(message) {
    messageEl.textContent = message;
  }

  function setError(message) {
    errorEl.textContent = message;
    errorEl.classList.toggle("active", Boolean(message));
  }

  function parseScalar(raw) {
    const value = raw.trim();
    if (value === "") {
      return "";
    }
    if (value === "null" || value === "~") {
      return null;
    }
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      if (value.startsWith("\"")) {
        try {
          return JSON.parse(value);
        } catch (error) {
          return value.slice(1, -1);
        }
      }
      return value.slice(1, -1).replace(/\\'/g, "'");
    }
    return value;
  }

  function stringifyScalar(value) {
    if (value === null) {
      return "null";
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value !== "string") {
      return JSON.stringify(value);
    }
    if (value.length === 0) {
      return "\"\"";
    }
    const safe = /^[A-Za-z0-9._/\-]+$/.test(value) && !["true", "false", "null", "~"].includes(value);
    return safe ? value : JSON.stringify(value);
  }

  function parseCSV(input) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      const next = input[i + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") {
          i += 1;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (inQuotes) {
      throw new Error("CSV parse error: unmatched quote.");
    }
    row.push(field);
    if (!(row.length === 1 && row[0] === "" && rows.length > 0)) {
      rows.push(row);
    }
    if (rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    if (headers.length === 0 || headers.every((h) => h.trim() === "")) {
      throw new Error("CSV parse error: missing header row.");
    }

    const records = [];
    for (let i = 1; i < rows.length; i += 1) {
      const values = rows[i];
      if (values.length === 1 && values[0] === "" && headers.length === 1 && headers[0] === "") {
        continue;
      }
      const record = {};
      headers.forEach((header, headerIndex) => {
        record[header || `column_${headerIndex + 1}`] = values[headerIndex] !== undefined ? values[headerIndex] : "";
      });
      records.push(record);
    }
    return records;
  }

  function flattenObject(obj, prefix, out) {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        out[fullKey] = JSON.stringify(value);
      } else if (value !== null && typeof value === "object") {
        flattenObject(value, fullKey, out);
      } else {
        out[fullKey] = value;
      }
    });
  }

  function normalizeForCSV(data) {
    if (Array.isArray(data)) {
      if (data.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
        return data.map((item) => {
          const flat = {};
          flattenObject(item, "", flat);
          return flat;
        });
      }
      return data.map((item) => ({ value: typeof item === "object" ? JSON.stringify(item) : item }));
    }
    if (data !== null && typeof data === "object") {
      const flat = {};
      flattenObject(data, "", flat);
      return [flat];
    }
    return [{ value: data }];
  }

  function escapeCSVCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  }

  function toCSV(data) {
    const rows = normalizeForCSV(data);
    const headerSet = new Set();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => headerSet.add(key));
    });
    const headers = Array.from(headerSet);
    if (headers.length === 0) {
      return "";
    }
    const lines = [];
    lines.push(headers.map(escapeCSVCell).join(","));
    rows.forEach((row) => {
      const line = headers.map((header) => escapeCSVCell(row[header])).join(",");
      lines.push(line);
    });
    return lines.join("\n");
  }

  function nextSignificantLine(lines, startIndex) {
    for (let i = startIndex; i < lines.length; i += 1) {
      const raw = lines[i];
      if (!raw || raw.trim() === "" || raw.trim().startsWith("#")) {
        continue;
      }
      const indent = raw.match(/^ */)[0].length;
      return { raw, indent, content: raw.trim() };
    }
    return null;
  }

  function parseYAML(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const stack = [];
    let root;

    function ensureParent(indent, typeHint) {
      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      if (stack.length > 0) {
        return stack[stack.length - 1];
      }
      if (root === undefined) {
        root = typeHint === "array" ? [] : {};
        stack.push({ indent: -1, type: Array.isArray(root) ? "array" : "object", value: root });
      }
      return stack[stack.length - 1];
    }

    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      if (!raw || raw.trim() === "" || raw.trim().startsWith("#")) {
        continue;
      }
      const indent = raw.match(/^ */)[0].length;
      const content = raw.trim();

      if (content.startsWith("- ")) {
        const parent = ensureParent(indent, "array");
        if (parent.type !== "array") {
          throw new Error(`YAML parse error at line ${i + 1}: sequence item not under array.`);
        }
        const itemText = content.slice(2).trim();
        if (itemText === "") {
          const probe = nextSignificantLine(lines, i + 1);
          const child = probe && probe.indent > indent && probe.content.startsWith("- ") ? [] : {};
          parent.value.push(child);
          stack.push({ indent, type: Array.isArray(child) ? "array" : "object", value: child });
          continue;
        }
        const mapMatch = itemText.match(/^([^:]+):(.*)$/);
        if (mapMatch) {
          const obj = {};
          const key = mapMatch[1].trim();
          const rest = mapMatch[2].trim();
          if (rest === "") {
            const probe = nextSignificantLine(lines, i + 1);
            obj[key] = probe && probe.indent > indent && probe.content.startsWith("- ") ? [] : {};
          } else {
            obj[key] = parseScalar(rest);
          }
          parent.value.push(obj);
          stack.push({ indent, type: "object", value: obj });
        } else {
          parent.value.push(parseScalar(itemText));
        }
        continue;
      }

      const match = content.match(/^([^:]+):(.*)$/);
      if (!match) {
        throw new Error(`YAML parse error at line ${i + 1}: expected key/value pair.`);
      }
      const key = match[1].trim();
      const rest = match[2].trim();

      const parent = ensureParent(indent, "object");
      if (parent.type !== "object") {
        throw new Error(`YAML parse error at line ${i + 1}: mapping entry not under object.`);
      }

      if (rest === "") {
        const probe = nextSignificantLine(lines, i + 1);
        const child = probe && probe.indent > indent && probe.content.startsWith("- ") ? [] : {};
        parent.value[key] = child;
        stack.push({ indent, type: Array.isArray(child) ? "array" : "object", value: child });
      } else {
        parent.value[key] = parseScalar(rest);
      }
    }

    return root === undefined ? {} : root;
  }

  function toYAML(value, indent) {
    const space = " ".repeat(indent);
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item !== null && typeof item === "object") {
          return `${space}-\n${toYAML(item, indent + 2)}`;
        }
        return `${space}- ${stringifyScalar(item)}`;
      }).join("\n");
    }
    if (value !== null && typeof value === "object") {
      return Object.entries(value).map(([key, item]) => {
        if (item !== null && typeof item === "object") {
          return `${space}${key}:\n${toYAML(item, indent + 2)}`;
        }
        return `${space}${key}: ${stringifyScalar(item)}`;
      }).join("\n");
    }
    return `${space}${stringifyScalar(value)}`;
  }

  function parseByFormat(format, text) {
    if (format === "csv") {
      return parseCSV(text);
    }
    if (format === "json") {
      return JSON.parse(text);
    }
    if (format === "yaml") {
      return parseYAML(text);
    }
    throw new Error(`Unsupported source format: ${format}`);
  }

  function serializeByFormat(format, data) {
    if (format === "csv") {
      return toCSV(data);
    }
    if (format === "json") {
      return JSON.stringify(data, null, 2);
    }
    if (format === "yaml") {
      return toYAML(data, 0);
    }
    throw new Error(`Unsupported target format: ${format}`);
  }

  function convert() {
    const sourceFormat = sourceFormatEl.value;
    const targetFormat = targetFormatEl.value;
    const input = inputTextEl.value;

    setError("");
    setMessage("");

    if (!input.trim()) {
      outputTextEl.value = "";
      setError(`No input provided for ${sourceFormat.toUpperCase()} conversion.`);
      return;
    }

    if (sourceFormat === targetFormat) {
      outputTextEl.value = input;
      setMessage(`No conversion needed: source and target are both ${sourceFormat.toUpperCase()}.`);
      return;
    }

    try {
      const parsed = parseByFormat(sourceFormat, input);
      const output = serializeByFormat(targetFormat, parsed);
      outputTextEl.value = output;
      setMessage(`Converted ${sourceFormat.toUpperCase()} -> ${targetFormat.toUpperCase()}.`);
    } catch (error) {
      outputTextEl.value = "";
      setError(`${sourceFormat.toUpperCase()} parse error: ${error.message}`);
    }
  }

  function swapFormats() {
    const source = sourceFormatEl.value;
    sourceFormatEl.value = targetFormatEl.value;
    targetFormatEl.value = source;
    setMessage("Source and target formats swapped.");
    setError("");
  }

  function downloadOutput() {
    const value = outputTextEl.value;
    const format = targetFormatEl.value;
    if (!value) {
      setError("No output available to download.");
      return;
    }
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `converted.${extensions[format]}`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded converted.${extensions[format]}.`);
    setError("");
  }

  convertBtn.addEventListener("click", convert);
  swapBtn.addEventListener("click", swapFormats);
  downloadBtn.addEventListener("click", downloadOutput);
})();
