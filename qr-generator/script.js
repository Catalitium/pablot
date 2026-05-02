(function () {
  "use strict";

  var MAX_LEN = 2953;
  var DEBOUNCE_MS = 120;

  var inputEl = document.getElementById("qrInput");
  var clearBtn = document.getElementById("clearBtn");
  var charCountEl = document.getElementById("charCount");
  var qrHost = document.getElementById("qrHost");
  var qrPlaceholder = document.getElementById("qrPlaceholder");
  var downloadBtn = document.getElementById("downloadBtn");
  var copyBtn = document.getElementById("copyBtn");
  var toastEl = document.getElementById("toast");

  var qr = new QRCode(qrHost, {
    width: 280,
    height: 280,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  var debounceTimer = null;
  var toastTimer = null;

  function getCanvas() {
    var c = qrHost.querySelector("canvas");
    return c || null;
  }

  function setOutputsEnabled(on) {
    if (on) {
      copyBtn.disabled = false;
      downloadBtn.setAttribute("aria-disabled", "false");
      downloadBtn.removeAttribute("tabindex");
    } else {
      copyBtn.disabled = true;
      downloadBtn.setAttribute("aria-disabled", "true");
      downloadBtn.setAttribute("tabindex", "-1");
      downloadBtn.setAttribute("href", "#");
    }
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
      toastTimer = setTimeout(function () {
        toastEl.hidden = true;
      }, 300);
    }, 2000);
  }

  function updateCharCount() {
    var len = inputEl.value.length;
    charCountEl.textContent = len + " / " + MAX_LEN;
  }

  function applyQrFromInput() {
    var text = inputEl.value.slice(0, MAX_LEN);
    if (text.length > MAX_LEN) {
      inputEl.value = text;
    }
    updateCharCount();

    if (!text.trim()) {
      qr.clear();
      qrHost.classList.remove("is-visible");
      qrPlaceholder.textContent = "Type above to generate a QR code";
      qrPlaceholder.classList.remove("is-hidden");
      qrHost.removeAttribute("aria-label");
      setOutputsEnabled(false);
      return;
    }

    try {
      qrPlaceholder.textContent = "Type above to generate a QR code";
      qr.makeCode(text);
      qrHost.classList.add("is-visible");
      qrPlaceholder.classList.add("is-hidden");
      qrHost.setAttribute("aria-label", "QR code for your text");
      setOutputsEnabled(true);

      var canvas = getCanvas();
      if (canvas) {
        try {
          downloadBtn.href = canvas.toDataURL("image/png");
        } catch (e) {
          downloadBtn.setAttribute("href", "#");
        }
      }
    } catch (e) {
      qr.clear();
      qrHost.classList.remove("is-visible");
      qrPlaceholder.classList.remove("is-hidden");
      qrPlaceholder.textContent = "Could not encode this content as a QR code.";
      setOutputsEnabled(false);
    }
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyQrFromInput, DEBOUNCE_MS);
  }

  clearBtn.addEventListener("click", function () {
    inputEl.value = "";
    inputEl.focus();
    qrPlaceholder.textContent = "Type above to generate a QR code";
    applyQrFromInput();
  });

  inputEl.addEventListener("input", scheduleUpdate);

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      clearBtn.click();
    }
  });

  downloadBtn.addEventListener("click", function (e) {
    if (downloadBtn.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
    }
  });

  copyBtn.addEventListener("click", function () {
    var canvas = getCanvas();
    if (!canvas) return;

    canvas.toBlob(function (blob) {
      if (!blob) {
        showToast("Could not copy");
        return;
      }
      if (!navigator.clipboard || !window.ClipboardItem) {
        showToast("Clipboard not available");
        return;
      }
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": blob })])
        .then(function () {
          showToast("Copied!");
        })
        .catch(function () {
          showToast("Copy failed");
        });
    }, "image/png");
  });

  updateCharCount();
  setOutputsEnabled(false);
})();
