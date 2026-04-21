/**
 * Harvard-style bullet template — derived from template/2026-template_bullet.docx
 * (Calibri, centered name + rule, centered section headings, indented bullets).
 * Section order matches student resume convention: Education before Experience when educationFirst.
 */
window.CV_TEMPLATE = {
  name: "harvard-bullet-2026",
  fontStack: 'Calibri, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  cssVars: {
    nameSize: "22pt",
    bodySize: "11pt",
    smallSize: "10pt",
    sectionGap: "0.16in",
    bulletIndent: "0.22in",
    pagePadX: "0.55in",
    pagePadY: "0.45in",
  },
  /** Which logical blocks to render and in what order */
  /** Student-style: Education early (closer to reference DOCX); summary optional after core blocks. */
  orders: {
    educationFirst: [
      "education",
      "experience",
      "summary",
      "skills",
      "certifications",
      "projects",
      "languages",
      "additional",
    ],
    experienceFirst: [
      "experience",
      "education",
      "summary",
      "skills",
      "certifications",
      "projects",
      "languages",
      "additional",
    ],
  },
};
