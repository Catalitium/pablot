/**
 * CV Builder — raw + normalized state, single renderCvDocument() for preview & print.
 * PDF export = browser print → Save as PDF (same HTML/CSS as preview).
 */

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_PHONE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{10,15}/g;
const RE_URL = /https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+/gi;

const emptyExp = () => ({
  role: "",
  company: "",
  location: "",
  start: "",
  end: "",
  bullets: "",
});

const emptyEdu = () => ({
  degree: "",
  institution: "",
  location: "",
  start: "",
  end: "",
  notes: "",
});

const emptyProj = () => ({
  name: "",
  link: "",
  description: "",
  bullets: "",
});

function defaultState() {
  return {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    links: "",
    summary: "",
    experience: [emptyExp()],
    education: [emptyEdu()],
    skills: "",
    certifications: "",
    projects: [emptyProj()],
    languages: "",
    additional: "",
    rawExtracted: "",
    ui: { phase: "landing", sectionOrder: "educationFirst" },
  };
}

let state = defaultState();

const $ = (id) => document.getElementById(id);

/** Load PDF.js only when a PDF is parsed (keeps first paint lighter). */
let pdfJsReady = null;
function ensurePdfJs() {
  if (typeof pdfjsLib !== "undefined") return Promise.resolve();
  if (pdfJsReady) return pdfJsReady;
  pdfJsReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.async = true;
    s.onload = () => {
      if (typeof pdfjsLib !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      resolve();
    };
    s.onerror = () => reject(new Error("Could not load PDF.js"));
    document.head.appendChild(s);
  });
  return pdfJsReady;
}

function buildRenderModel(s) {
  return {
    ...s,
    experience: (s.experience || []).filter((e) => e.role || e.company || e.bullets),
    education: (s.education || []).filter((e) => e.degree || e.institution),
    projects: (s.projects || []).filter((p) => p.name || p.description || p.bullets),
  };
}

function extractionConfidenceLine(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (!words) return "No text extracted.";
  if (words < 45) return `Light extraction (${words} words) — fill gaps in Edit or paste under Advanced.`;
  return `Extracted about ${words} words — review the preview.`;
}

function updateThinBanner(show, innerHtml) {
  const b = $("thinBanner");
  if (!b) return;
  if (!show) {
    b.hidden = true;
    b.innerHTML = "";
    return;
  }
  b.hidden = false;
  b.innerHTML = `<div class="thin-banner-inner">${innerHtml}</div>`;
}

function openPersonalIfNoName() {
  const det = $("detailsPersonal");
  if (det && !state.fullName?.trim()) det.open = true;
}

function setStatus(msg, kind) {
  const el = $("statusMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("is-warn", "is-ok");
  if (kind === "warn") el.classList.add("is-warn");
  if (kind === "ok") el.classList.add("is-ok");
}

function bulletsToLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function detectFromText(text) {
  const emails = text.match(RE_EMAIL) || [];
  const phones = text.match(RE_PHONE) || [];
  const urls = text.match(RE_URL) || [];
  return {
    email: emails[0] || "",
    phone: phones[0] || "",
    links: [...new Set(urls)].slice(0, 5).join(" "),
  };
}

function hasMeaningfulContent(s) {
  return !!(
    s.fullName?.trim() ||
    s.summary?.trim() ||
    s.skills?.trim() ||
    s.experience?.some((e) => e.role || e.company || e.bullets) ||
    s.education?.some((e) => e.degree || e.institution) ||
    s.projects?.some((p) => p.name || p.description || p.bullets) ||
    s.certifications?.trim() ||
    s.languages?.trim() ||
    s.additional?.trim()
  );
}

function applyHeuristicParse(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const d = detectFromText(raw);
  if (d.email) state.email = d.email;
  if (d.phone) state.phone = d.phone;
  if (d.links) state.links = state.links ? `${state.links} ${d.links}` : d.links;

  if (nonEmpty.length && !state.fullName) {
    const first = nonEmpty[0];
    if (first.length < 60 && first.split(/\s+/).length <= 5 && !/@/.test(first)) {
      state.fullName = first;
    }
  }

  const sectionMap = {
    summary: ["summary", "profile", "objective", "about"],
    experience: ["experience", "work experience", "employment", "professional experience"],
    education: ["education", "academic"],
    skills: ["skills", "technical skills", "core competencies"],
    projects: ["projects", "selected projects"],
  };

  let current = "other";
  const buckets = { summary: [], experience: [], education: [], skills: [], projects: [], other: [] };

  for (const line of nonEmpty) {
    const low = line.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    let header = false;
    for (const [key, keys] of Object.entries(sectionMap)) {
      if (keys.some((k) => low === k || low.startsWith(k + " "))) {
        current = key;
        header = true;
        break;
      }
    }
    if (header) continue;

    if (buckets[current]) buckets[current].push(line);
    else buckets.other.push(line);
  }

  const join = (arr) => arr.join("\n").trim();
  if (buckets.summary.length && !state.summary) state.summary = join(buckets.summary);
  if (!state.summary && buckets.other.length) {
    state.summary = join(buckets.other.slice(0, 12));
  }
  if (buckets.skills.length && !state.skills) state.skills = join(buckets.skills).replace(/\n/g, ", ");

  if (buckets.experience.length) {
    state.experience = parseExperienceLoose(join(buckets.experience));
  }
  if (buckets.education.length) {
    state.education = parseEducationLoose(join(buckets.education));
  }
}

function parseExperienceLoose(text) {
  const blocks = text.split(/\n\n+/);
  const out = [];
  for (const b of blocks) {
    const line = b.split(/\r?\n/).map((l) => l.trim());
    const head = line[0] || "";
    const roleCompany = head.split(/\s+[|·]\s*|\s+at\s+/i);
    const bullets = line.slice(1).filter((l) => /^[-•*▪]/.test(l) || l.length > 2);
    const bulletStr = bullets
      .map((l) => l.replace(/^[-•*▪]\s*/, ""))
      .join("\n");
    out.push({
      role: roleCompany[0] || "",
      company: roleCompany[1] || "",
      location: "",
      start: "",
      end: "",
      bullets: bulletStr || (line.length > 1 ? line.slice(1).join("\n") : ""),
    });
  }
  if (!out.length) return [emptyExp()];
  return out;
}

function parseEducationLoose(text) {
  const blocks = text.split(/\n\n+/);
  const out = [];
  for (const b of blocks) {
    const line = b.split(/\r?\n/).map((l) => l.trim());
    out.push({
      degree: line[0] || "",
      institution: line[1] || "",
      location: "",
      start: "",
      end: "",
      notes: line.slice(2).join("\n"),
    });
  }
  if (!out.length) return [emptyEdu()];
  return out;
}

function syncFromDOM() {
  state.fullName = $("fullName").value.trim();
  state.headline = $("headline").value.trim();
  state.email = $("email").value.trim();
  state.phone = $("phone").value.trim();
  state.location = $("location").value.trim();
  state.links = $("links").value.trim();
  state.summary = $("summary").value.trim();
  state.skills = $("skills").value.trim();
  state.certifications = $("certifications").value.trim();
  state.languages = $("languages").value.trim();
  state.additional = $("additional").value.trim();
  state.rawExtracted = $("rawText").value;
  const intent = $("resumeIntent");
  if (intent) state.ui.sectionOrder = intent.value === "professional" ? "experienceFirst" : "educationFirst";

  state.experience = [];
  document.querySelectorAll("[data-exp-block]").forEach((node) => {
    const i = node.dataset.index;
    state.experience.push({
      role: node.querySelector(`[name="exp-role-${i}"]`)?.value.trim() || "",
      company: node.querySelector(`[name="exp-company-${i}"]`)?.value.trim() || "",
      location: node.querySelector(`[name="exp-location-${i}"]`)?.value.trim() || "",
      start: node.querySelector(`[name="exp-start-${i}"]`)?.value.trim() || "",
      end: node.querySelector(`[name="exp-end-${i}"]`)?.value.trim() || "",
      bullets: node.querySelector(`[name="exp-bullets-${i}"]`)?.value.trim() || "",
    });
  });
  if (!state.experience.length) state.experience = [emptyExp()];

  state.education = [];
  document.querySelectorAll("[data-edu-block]").forEach((node) => {
    const i = node.dataset.index;
    state.education.push({
      degree: node.querySelector(`[name="edu-degree-${i}"]`)?.value.trim() || "",
      institution: node.querySelector(`[name="edu-inst-${i}"]`)?.value.trim() || "",
      location: node.querySelector(`[name="edu-location-${i}"]`)?.value.trim() || "",
      start: node.querySelector(`[name="edu-start-${i}"]`)?.value.trim() || "",
      end: node.querySelector(`[name="edu-end-${i}"]`)?.value.trim() || "",
      notes: node.querySelector(`[name="edu-notes-${i}"]`)?.value.trim() || "",
    });
  });
  if (!state.education.length) state.education = [emptyEdu()];

  state.projects = [];
  document.querySelectorAll("[data-proj-block]").forEach((node) => {
    const i = node.dataset.index;
    state.projects.push({
      name: node.querySelector(`[name="proj-name-${i}"]`)?.value.trim() || "",
      link: node.querySelector(`[name="proj-link-${i}"]`)?.value.trim() || "",
      description: node.querySelector(`[name="proj-desc-${i}"]`)?.value.trim() || "",
      bullets: node.querySelector(`[name="proj-bullets-${i}"]`)?.value.trim() || "",
    });
  });
  if (!state.projects.length) state.projects = [emptyProj()];
}

function fillStaticFields() {
  $("fullName").value = state.fullName;
  $("headline").value = state.headline;
  $("email").value = state.email;
  $("phone").value = state.phone;
  $("location").value = state.location;
  $("links").value = state.links;
  $("summary").value = state.summary;
  $("skills").value = state.skills;
  $("certifications").value = state.certifications;
  $("languages").value = state.languages;
  $("additional").value = state.additional;
  $("rawText").value = state.rawExtracted;
  const intent = $("resumeIntent");
  if (intent) intent.value = state.ui.sectionOrder === "experienceFirst" ? "professional" : "student";
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeTextarea(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function contactLineHtml(s) {
  const parts = [];
  if (s.location) parts.push(escapeHtml(s.location));
  if (s.email) parts.push(`<a href="mailto:${escapeAttr(s.email)}">${escapeHtml(s.email)}</a>`);
  if (s.phone) parts.push(escapeHtml(s.phone));
  if (s.links) {
    const links = s.links.split(/[\s,]+/).filter(Boolean);
    for (const l of links) {
      const href = l.startsWith("http") ? l : `https://${l}`;
      parts.push(`<a href="${escapeAttr(href)}">${escapeHtml(l)}</a>`);
    }
  }
  if (!parts.length) return "";
  return parts.join(" · ");
}

/** Single HTML template for preview + print (Harvard-style rhythm). */
function renderCvDocument(s) {
  const model = buildRenderModel(s);
  const tmpl = window.CV_TEMPLATE || { orders: {} };
  const orderKey = model.ui?.sectionOrder === "experienceFirst" ? "experienceFirst" : "educationFirst";
  const order = tmpl.orders?.[orderKey] || [
    "education",
    "experience",
    "summary",
    "skills",
    "certifications",
    "projects",
    "languages",
    "additional",
  ];

  const wrapSec = (key, inner) => (inner ? `<section class="cv-section" data-section="${key}">${inner}</section>` : "");

  let html = `<div class="cv-doc-inner">`;

  html += `<header class="cv-header-block" data-section="header">`;
  if (model.fullName) html += `<h1 class="cv-name">${escapeHtml(model.fullName)}</h1>`;
  else html += `<h1 class="cv-name cv-placeholder">Your name</h1>`;

  if (model.headline) html += `<p class="cv-headline">${escapeHtml(model.headline)}</p>`;

  html += `<hr class="cv-rule" />`;

  const cl = contactLineHtml(model);
  if (cl) html += `<p class="cv-contact">${cl}</p>`;
  else html += `<p class="cv-contact cv-placeholder">City, State · email · phone</p>`;
  html += `</header>`;

  const exps = model.experience || [];
  const edus = model.education || [];
  const projs = model.projects || [];

  const renderSummary = () => {
    if (!model.summary?.trim()) return "";
    let h = `<h2 class="cv-section-title">Summary</h2>`;
    h += `<p class="cv-summary">${escapeHtml(model.summary).replace(/\n/g, "<br>")}</p>`;
    return h;
  };

  const renderEducation = () => {
    if (!edus.length) return "";
    let h = `<h2 class="cv-section-title">Education</h2>`;
    for (const e of edus) {
      const dates = [e.start, e.end].filter(Boolean).join(" – ");
      const locDate = [e.location, dates].filter(Boolean).join(" · ");
      h += `<div class="cv-edu-block">`;
      h += `<div class="cv-edu-head">`;
      h += `<span class="cv-edu-inst">${escapeHtml(e.institution || "")}</span>`;
      h += `<span class="cv-edu-right">${escapeHtml(locDate)}</span>`;
      h += `</div>`;
      if (e.degree) h += `<p class="cv-edu-degree">${escapeHtml(e.degree)}</p>`;
      if (e.notes) h += `<p class="cv-edu-notes">${escapeHtml(e.notes).replace(/\n/g, "<br>")}</p>`;
      h += `</div>`;
    }
    return h;
  };

  const renderExperience = () => {
    if (!exps.length) return "";
    let h = `<h2 class="cv-section-title">Experience</h2>`;
    for (const e of exps) {
      const dates = [e.start, e.end].filter(Boolean).join(" – ");
      const left = [e.role, e.company].filter(Boolean).join(" — ");
      const sub = [left, e.location].filter(Boolean).join(" · ");
      h += `<div class="cv-exp-block">`;
      h += `<div class="cv-exp-head">`;
      h += `<span class="cv-exp-left">${escapeHtml(sub)}</span>`;
      h += `<span class="cv-exp-right">${escapeHtml(dates)}</span>`;
      h += `</div>`;
      const bs = bulletsToLines(e.bullets);
      if (bs.length) h += `<ul class="cv-bullets">${bs.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
      h += `</div>`;
    }
    return h;
  };

  const renderSkills = () => {
    if (!model.skills?.trim()) return "";
    return `<h2 class="cv-section-title">Skills</h2><p class="cv-skills">${escapeHtml(model.skills).replace(/\n/g, "<br>")}</p>`;
  };

  const renderCerts = () => {
    const certs = bulletsToLines(model.certifications);
    if (!certs.length) return "";
    let h = `<h2 class="cv-section-title">Certifications</h2>`;
    h += `<ul class="cv-bullets">${certs.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`;
    return h;
  };

  const renderProjects = () => {
    if (!projs.length) return "";
    let h = `<h2 class="cv-section-title">Projects</h2>`;
    for (const p of projs) {
      h += `<div class="cv-proj-block">`;
      h += `<div class="cv-proj-head"><span class="cv-proj-name">${escapeHtml(p.name)}</span>`;
      if (p.link) {
        const href = p.link.startsWith("http") ? p.link : `https://${p.link}`;
        h += ` <a class="cv-proj-link" href="${escapeAttr(href)}">${escapeHtml(p.link)}</a>`;
      }
      h += `</div>`;
      if (p.description) h += `<p class="cv-proj-desc">${escapeHtml(p.description)}</p>`;
      const bs = bulletsToLines(p.bullets);
      if (bs.length) h += `<ul class="cv-bullets">${bs.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
      h += `</div>`;
    }
    return h;
  };

  const renderLanguages = () => {
    if (!model.languages?.trim()) return "";
    return `<h2 class="cv-section-title">Languages</h2><p class="cv-lang">${escapeHtml(model.languages)}</p>`;
  };

  const renderAdditional = () => {
    if (!model.additional?.trim()) return "";
    return `<h2 class="cv-section-title">Additional information</h2><p class="cv-additional">${escapeHtml(model.additional).replace(/\n/g, "<br>")}</p>`;
  };

  const parts = {
    summary: renderSummary,
    education: renderEducation,
    experience: renderExperience,
    skills: renderSkills,
    certifications: renderCerts,
    projects: renderProjects,
    languages: renderLanguages,
    additional: renderAdditional,
  };

  for (const key of order) {
    if (parts[key]) html += wrapSec(key, parts[key]());
  }

  html += `</div>`;
  return html;
}

function landingHtml() {
  return `<div class="cv-doc-inner cv-landing">
    <p class="cv-landing-kicker">Harvard-style layout</p>
    <p class="cv-landing-title">Upload a CV to see your document here</p>
    <p class="cv-landing-body">We’ll extract text locally and map it into this template. You can refine details afterward — only if needed.</p>
    <hr class="cv-rule cv-rule--muted" />
    <p class="cv-landing-note">Tip: use <strong>See a sample layout</strong> in the upload area to preview instantly.</p>
  </div>`;
}

/** Thin extraction: show template shell + banner above the edit stack (not inside print root). */
function thinExtractionHtml(s) {
  const rawHint = s.rawExtracted?.trim()
    ? `<p class="cv-thin-hint">We couldn’t map everything into sections. Use <strong>Edit</strong> below or <strong>Advanced → raw text</strong>.</p>`
    : `<p class="cv-thin-hint">No structured content yet. Open <strong>Edit personal details</strong> or paste text under Advanced.</p>`;
  updateThinBanner(true, rawHint);
  return renderCvDocument(s);
}

function renderPreview() {
  const root = $("cvPreview");
  syncFromDOM();

  if (state.ui.phase === "landing") {
    updateThinBanner(false);
    root.innerHTML = landingHtml();
    return;
  }

  if (!hasMeaningfulContent(state)) {
    root.innerHTML = thinExtractionHtml(state);
    return;
  }

  updateThinBanner(false);
  root.innerHTML = renderCvDocument(state);
}

function renderExperienceHTML() {
  const el = $("experienceList");
  if (!el) return;
  el.innerHTML = state.experience
    .map(
      (exp, i) => `
    <div class="repeat-block" data-exp-block data-index="${i}">
      <div class="repeat-block-head">
        <span class="repeat-block-title">Role ${i + 1}</span>
        <div class="repeat-tools">
          <button type="button" class="btn btn--ghost" data-exp-move="${i}" data-dir="-1" aria-label="Move up">↑</button>
          <button type="button" class="btn btn--ghost" data-exp-move="${i}" data-dir="1" aria-label="Move down">↓</button>
          <button type="button" class="btn btn--ghost" data-exp-remove="${i}" aria-label="Remove">Remove</button>
        </div>
      </div>
      <div class="repeat-grid">
        <label>Role <input type="text" name="exp-role-${i}" value="${escapeAttr(exp.role)}" autocomplete="off"></label>
        <label>Company <input type="text" name="exp-company-${i}" value="${escapeAttr(exp.company)}" autocomplete="organization"></label>
        <label>Location <input type="text" name="exp-location-${i}" value="${escapeAttr(exp.location)}"></label>
        <label>Start <input type="text" name="exp-start-${i}" value="${escapeAttr(exp.start)}"></label>
        <label>End <input type="text" name="exp-end-${i}" value="${escapeAttr(exp.end)}"></label>
      </div>
      <div class="bullet-list" style="margin-top:10px">
        <label>Bullets (one per line) <textarea name="exp-bullets-${i}" rows="4">${escapeTextarea(exp.bullets)}</textarea></label>
      </div>
    </div>`
    )
    .join("");
}

function renderEducationHTML() {
  const el = $("educationList");
  if (!el) return;
  el.innerHTML = state.education
    .map(
      (edu, i) => `
    <div class="repeat-block" data-edu-block data-index="${i}">
      <div class="repeat-block-head">
        <span class="repeat-block-title">School ${i + 1}</span>
        <div class="repeat-tools">
          <button type="button" class="btn btn--ghost" data-edu-move="${i}" data-dir="-1" aria-label="Move up">↑</button>
          <button type="button" class="btn btn--ghost" data-edu-move="${i}" data-dir="1" aria-label="Move down">↓</button>
          <button type="button" class="btn btn--ghost" data-edu-remove="${i}" aria-label="Remove">Remove</button>
        </div>
      </div>
      <div class="repeat-grid">
        <label>Institution <input type="text" name="edu-inst-${i}" value="${escapeAttr(edu.institution)}"></label>
        <label>Location / City <input type="text" name="edu-location-${i}" value="${escapeAttr(edu.location)}"></label>
        <label>Degree / program <input type="text" name="edu-degree-${i}" value="${escapeAttr(edu.degree)}"></label>
        <label>Start <input type="text" name="edu-start-${i}" value="${escapeAttr(edu.start)}"></label>
        <label>End <input type="text" name="edu-end-${i}" value="${escapeAttr(edu.end)}"></label>
      </div>
      <div style="margin-top:10px">
        <label>Honors / notes <textarea name="edu-notes-${i}" rows="2">${escapeTextarea(edu.notes)}</textarea></label>
      </div>
    </div>`
    )
    .join("");
}

function renderProjectsHTML() {
  const el = $("projectsList");
  if (!el) return;
  el.innerHTML = state.projects
    .map(
      (p, i) => `
    <div class="repeat-block" data-proj-block data-index="${i}">
      <div class="repeat-block-head">
        <span class="repeat-block-title">Project ${i + 1}</span>
        <div class="repeat-tools">
          <button type="button" class="btn btn--ghost" data-proj-move="${i}" data-dir="-1" aria-label="Move up">↑</button>
          <button type="button" class="btn btn--ghost" data-proj-move="${i}" data-dir="1" aria-label="Move down">↓</button>
          <button type="button" class="btn btn--ghost" data-proj-remove="${i}" aria-label="Remove">Remove</button>
        </div>
      </div>
      <div class="repeat-grid">
        <label>Name <input type="text" name="proj-name-${i}" value="${escapeAttr(p.name)}"></label>
        <label>Link <input type="url" name="proj-link-${i}" placeholder="https://" value="${escapeAttr(p.link)}"></label>
      </div>
      <div style="margin-top:10px">
        <label>Description <textarea name="proj-desc-${i}" rows="2">${escapeTextarea(p.description)}</textarea></label>
      </div>
      <div class="bullet-list" style="margin-top:10px">
        <label>Bullets (one per line) <textarea name="proj-bullets-${i}" rows="3">${escapeTextarea(p.bullets)}</textarea></label>
      </div>
    </div>`
    )
    .join("");
}

function setDocumentPhase(active) {
  state.ui.phase = active ? "document" : "landing";
  const stack = $("editStack");
  const toolbar = $("toolbarDoc");
  if (stack) stack.hidden = !active;
  if (toolbar) toolbar.hidden = !active;
  document.body.classList.toggle("cv-document-phase", !!active);
}

function triggerPrint() {
  syncFromDOM();
  if (!state.fullName?.trim()) {
    setStatus("Add your full name under Edit personal details before saving a PDF.", "warn");
    openPersonalIfNoName();
    return;
  }
  window.print();
}

async function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

async function extractTextFromPdf(buf) {
  await ensurePdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return out.replace(/\s+\n/g, "\n").trim();
}

async function extractTextFromDocx(buf) {
  if (typeof mammoth === "undefined") throw new Error("DOCX parser unavailable");
  const r = await mammoth.extractRawText({ arrayBuffer: buf });
  return (r.value || "").trim();
}

async function handleFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  setStatus("Reading file…", null);
  try {
    let text = "";
    if (name.endsWith(".txt")) {
      text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = rej;
        r.readAsText(file);
      });
    } else if (name.endsWith(".pdf")) {
      const buf = await readFileAsArrayBuffer(file);
      text = await extractTextFromPdf(buf);
    } else if (name.endsWith(".docx")) {
      const buf = await readFileAsArrayBuffer(file);
      text = await extractTextFromDocx(buf);
    } else {
      setStatus("Unsupported format. Use PDF, DOCX, or TXT.", "warn");
      return;
    }

    state.rawExtracted = text;
    $("rawText").value = text;
    setDocumentPhase(true);
    setStatus(extractionConfidenceLine(text), "ok");

    const det = detectFromText(text);
    if (det.email) state.email = det.email;
    if (det.phone) state.phone = det.phone;
    if (det.links) state.links = state.links ? `${state.links} ${det.links}` : det.links;

    applyHeuristicParse(text);
    fillStaticFields();
    renderExperienceHTML();
    renderEducationHTML();
    renderProjectsHTML();
    renderPreview();
    openPersonalIfNoName();
  } catch (e) {
    console.error(e);
    setStatus("Could not read that file. Try TXT or paste under Advanced.", "warn");
  }
}

function sampleData() {
  state = defaultState();
  state.fullName = "Alex Rivera";
  state.headline = "Product Engineer";
  state.email = "alex.rivera@email.com";
  state.phone = "+1 555 010 2345";
  state.location = "Berlin, Germany";
  state.links = "linkedin.com/in/alexrivera github.com/arivera";
  state.summary =
    "Engineer focused on shipping reliable tools and clear UX. 5+ years building web products and internal platforms for growing teams.";
  state.experience = [
    {
      role: "Senior Software Engineer",
      company: "Northwind Labs",
      location: "Remote",
      start: "2021",
      end: "Present",
      bullets:
        "- Led migration of core services to a static-first architecture\n- Cut incident response time by 35% through better observability\n- Mentored 4 engineers on TypeScript and release discipline",
    },
    {
      role: "Software Engineer",
      company: "Contoso Systems",
      location: "London, UK",
      start: "2018",
      end: "2021",
      bullets: "- Built internal admin tools used by 200+ staff\n- Improved CI/CD reliability with staged rollouts",
    },
  ];
  state.education = [
    {
      degree: "B.Sc. Computer Science",
      institution: "University of Example",
      location: "Manchester, UK",
      start: "2014",
      end: "2018",
      notes: "Honors: Dean’s List. Final project: distributed job queue.",
    },
  ];
  state.skills = "TypeScript, JavaScript, HTML/CSS, Node.js, PostgreSQL, Git, CI/CD, System design";
  state.certifications = "AWS Certified Developer — Associate\nCertified Scrum Master (CSM)";
  state.projects = [
    {
      name: "OpenResume CLI",
      link: "https://github.com/example/openresume",
      description: "CLI to validate resume JSON and emit ATS-friendly HTML.",
      bullets: "- 1.2k stars\n- Used by 3 university career centers",
    },
  ];
  state.languages = "English (native), Spanish (professional)";
  state.additional = "Volunteer: weekend coding workshops for high school students.";
  state.ui.phase = "document";
  state.ui.sectionOrder = "educationFirst";
  fillStaticFields();
  renderExperienceHTML();
  renderEducationHTML();
  renderProjectsHTML();
  setDocumentPhase(true);
  renderPreview();
  setStatus("Sample loaded.", "ok");
}

function init() {
  setDocumentPhase(false);
  fillStaticFields();
  renderExperienceHTML();
  renderEducationHTML();
  renderProjectsHTML();
  renderPreview();

  const dz = $("dropzone");
  const fi = $("fileInput");

  dz.addEventListener("click", () => fi.click());
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fi.click();
    }
  });
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("is-drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("is-drag");
    })
  );
  dz.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  fi.addEventListener("change", () => {
    const f = fi.files[0];
    if (f) handleFile(f);
    fi.value = "";
  });

  $("btnSample").addEventListener("click", sampleData);
  $("btnReset").addEventListener("click", () => {
    if (!confirm("Clear everything and start over?")) return;
    state = defaultState();
    fillStaticFields();
    renderExperienceHTML();
    renderEducationHTML();
    renderProjectsHTML();
    setDocumentPhase(false);
    renderPreview();
    setStatus("", null);
    $("uploadRibbon")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("btnApplyRaw").addEventListener("click", () => {
    state.rawExtracted = $("rawText").value;
    applyHeuristicParse(state.rawExtracted);
    fillStaticFields();
    renderExperienceHTML();
    renderEducationHTML();
    renderProjectsHTML();
    setDocumentPhase(true);
    renderPreview();
    setStatus("Applied text to fields — review the preview.", "ok");
  });

  $("btnDetectContact").addEventListener("click", () => {
    const t = $("rawText").value;
    const d = detectFromText(t);
    if (d.email) $("email").value = d.email;
    if (d.phone) $("phone").value = d.phone;
    if (d.links) $("links").value = d.links;
    syncFromDOM();
    renderPreview();
    setStatus("Contact fields updated from text.", "ok");
  });

  $("btnSavePdf").addEventListener("click", triggerPrint);

  $("resumeIntent").addEventListener("change", () => {
    syncFromDOM();
    renderPreview();
  });

  $("btnAddExp").addEventListener("click", () => {
    syncFromDOM();
    state.experience.push(emptyExp());
    renderExperienceHTML();
    renderPreview();
  });
  $("btnAddEdu").addEventListener("click", () => {
    syncFromDOM();
    state.education.push(emptyEdu());
    renderEducationHTML();
    renderPreview();
  });
  $("btnAddProj").addEventListener("click", () => {
    syncFromDOM();
    state.projects.push(emptyProj());
    renderProjectsHTML();
    renderPreview();
  });

  $("experienceList").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-exp-remove]");
    const mv = e.target.closest("[data-exp-move]");
    if (rm) {
      syncFromDOM();
      const i = +rm.dataset.expRemove;
      if (state.experience.length > 1) state.experience.splice(i, 1);
      renderExperienceHTML();
      renderPreview();
    }
    if (mv) {
      syncFromDOM();
      const i = +mv.dataset.expMove;
      const dir = +mv.dataset.dir;
      const j = i + dir;
      if (j >= 0 && j < state.experience.length) {
        [state.experience[i], state.experience[j]] = [state.experience[j], state.experience[i]];
        renderExperienceHTML();
        renderPreview();
      }
    }
  });

  $("educationList").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-edu-remove]");
    const mv = e.target.closest("[data-edu-move]");
    if (rm) {
      syncFromDOM();
      const i = +rm.dataset.eduRemove;
      if (state.education.length > 1) state.education.splice(i, 1);
      renderEducationHTML();
      renderPreview();
    }
    if (mv) {
      syncFromDOM();
      const i = +mv.dataset.eduMove;
      const dir = +mv.dataset.dir;
      const j = i + dir;
      if (j >= 0 && j < state.education.length) {
        [state.education[i], state.education[j]] = [state.education[j], state.education[i]];
        renderEducationHTML();
        renderPreview();
      }
    }
  });

  $("projectsList").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-proj-remove]");
    const mv = e.target.closest("[data-proj-move]");
    if (rm) {
      syncFromDOM();
      const i = +rm.dataset.projRemove;
      if (state.projects.length > 1) state.projects.splice(i, 1);
      renderProjectsHTML();
      renderPreview();
    }
    if (mv) {
      syncFromDOM();
      const i = +mv.dataset.projMove;
      const dir = +mv.dataset.dir;
      const j = i + dir;
      if (j >= 0 && j < state.projects.length) {
        [state.projects[i], state.projects[j]] = [state.projects[j], state.projects[i]];
        renderProjectsHTML();
        renderPreview();
      }
    }
  });

  let renderTimer;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      syncFromDOM();
      renderPreview();
    }, 90);
  }
  document.getElementById("editStack")?.addEventListener("input", () => scheduleRender(), true);
  $("rawText").addEventListener("input", () => {
    state.rawExtracted = $("rawText").value;
  });
}

init();
