import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentCurriculum,
  buildDocumentCurriculumFromSections,
} from "./document-curriculum.js";

function sourceSections(count) {
  return Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
    text: `Section ${index + 1}\nThis source section explains a practical skill and its application.`,
  }));
}

function createPdf(text) {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join("")));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""));
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(chunks.join(""));
}

test("distributes source pages into four weeks and five ordered days per week", () => {
  const curriculum = buildDocumentCurriculumFromSections({
    documentTitle: "Workshop Skills",
    filename: "workshop.pdf",
    moduleCount: 2,
    sections: sourceSections(40),
  });

  assert.equal(curriculum.modules.length, 2);
  assert.ok(curriculum.modules.every((module) => module.weeks.length === 4));
  assert.ok(curriculum.modules.every((module) =>
    module.weeks.every((week) => week.days.length === 5)));
  assert.equal(curriculum.modules[0].weeks[0].sourcePageStart, 1);
  assert.deepEqual(
    curriculum.modules[0].weeks[0].days.map((day) => day.sourcePageStart),
    [1, 2, 3, 4, 5],
  );
  assert.equal(curriculum.modules[1].weeks[3].days[4].sourcePageEnd, 40);
  assert.match(curriculum.modules[0].weeks[0].description, /Source pages 1-5/);
});

test("extracts a PDF locally and includes its source text in the draft", async () => {
  const curriculum = await buildDocumentCurriculum({
    filename: "source.pdf",
    sourceBytes: createPdf("Practical safety procedures"),
    documentTitle: "Safety",
    moduleCount: 1,
  });

  assert.equal(curriculum.modules[0].weeks.length, 4);
  assert.ok(curriculum.modules[0].weeks.every((week) => week.days.length === 5));
  assert.equal(curriculum.modules[0].weeks[0].days[0].sourcePageStart, 1);
  const excerpts = curriculum.modules[0].weeks
    .flatMap((week) => week.days.map((day) => day.lessonContent))
    .join(" ");
  assert.match(excerpts, /Practical safety procedures/);
});

test("generates a flagged page-by-day plan when PDF text extraction fails", async () => {
  const curriculum = await buildDocumentCurriculum({
    filename: "unreadable.pdf",
    sourceBytes: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count 20 >>\nendobj\n"),
    documentTitle: "Workshop guide",
    moduleCount: 1,
  });

  assert.equal(curriculum.sourceExtractionFallback, true);
  assert.equal(curriculum.modules[0].weeks.length, 4);
  assert.ok(curriculum.modules[0].weeks.every((week) => week.days.length === 5));
  assert.equal(curriculum.modules[0].title, "Source pages 1-20");
  assert.equal(curriculum.modules[0].weeks[0].title, "Week 1: Source pages 1-5");
  assert.equal(curriculum.modules[0].weeks[0].days[0].sourcePageStart, 1);
  assert.equal(curriculum.modules[0].weeks[3].days[4].sourcePageEnd, 20);
  assert.match(curriculum.modules[0].weeks[0].days[0].lessonContent, /use the assigned page\(s\) as the lesson content/i);
  assert.match(curriculum.modules[0].description, /daily assignments are study guidance/i);
});

test("groups adjacent source pages together when a day covers multiple pages", () => {
  const curriculum = buildDocumentCurriculumFromSections({
    documentTitle: "Workshop Skills",
    filename: "workshop.pdf",
    moduleCount: 1,
    sections: sourceSections(40),
  });

  const weeks = curriculum.modules[0].weeks;
  assert.equal(weeks[0].days[0].sourcePageStart, 1);
  assert.equal(weeks[0].days[0].sourcePageEnd, 2);
  assert.equal(weeks[0].days[1].sourcePageStart, 3);
  assert.equal(weeks[0].days[1].sourcePageEnd, 4);
  assert.equal(weeks[3].days[4].sourcePageStart, 39);
  assert.equal(weeks[3].days[4].sourcePageEnd, 40);
});

test("keeps source order and places each module capstone after week four", () => {
  const curriculum = buildDocumentCurriculumFromSections({
    documentTitle: "Workshop Skills",
    filename: "workshop.pdf",
    moduleCount: 1,
    sections: sourceSections(4),
  });
  const weeks = curriculum.modules[0].weeks;
  const assignedPages = weeks.flatMap((week) =>
    week.days.map((day) => day.sourcePageStart).filter(Number.isInteger));

  assert.deepEqual(assignedPages, [1, 2, 3, 4]);
  assert.match(weeks[3].title, /^Week 4:/);
  assert.match(curriculum.modules[0].capstonePrompt, /At the end of Week 4/);
  assert.match(curriculum.modules[0].capstonePrompt, /Weeks 1-4/);
});

test("splits text into all weekly blocks when a document has fewer pages than weeks", () => {
  const curriculum = buildDocumentCurriculumFromSections({
    documentTitle: "Short guide",
    filename: "short.pdf",
    moduleCount: 2,
    sections: [{
      pageNumber: 1,
      text: Array.from({ length: 60 }, (_, index) => `Important source concept ${index + 1}.`).join(" "),
    }],
  });

  const weeks = curriculum.modules.flatMap((module) => module.weeks);
  const allDailyContent = weeks.flatMap((week) =>
    week.days.map((day) => day.lessonContent)).join(" ");
  assert.equal(weeks.length, 8);
  assert.ok(weeks.every((week) => week.lessonContent.length >= 20));
  assert.ok(weeks.some((week) => week.sourcePageStart === 1 && week.sourcePageEnd === 1));
  assert.match(allDailyContent, /Important source concept 1/);
  assert.match(allDailyContent, /Important source concept 60/);
});

test("supports image-only PDF pages with an explicit instruction to inspect the source", () => {
  const curriculum = buildDocumentCurriculumFromSections({
    documentTitle: "Scanned guide",
    filename: "scanned.pdf",
    moduleCount: 1,
    sections: [
      { pageNumber: 1, text: "" },
      { pageNumber: 2, text: "" },
      { pageNumber: 3, text: "" },
      { pageNumber: 4, text: "" },
    ],
  });

  assert.ok(curriculum.modules[0].weeks.some((week) =>
    /scanned pages/i.test(week.lessonContent)));
  assert.equal(curriculum.modules[0].title, "Source pages 1-4");
});

test("asks for more modules rather than truncating an oversized source", () => {
  assert.throws(() => buildDocumentCurriculumFromSections({
    documentTitle: "Long guide",
    filename: "long.docx",
    moduleCount: 1,
    sections: [{ text: "x".repeat(4 * 30000) }],
  }), /Choose more modules/);
});
