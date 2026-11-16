import mammoth from "mammoth";
import path from "node:path";
import { MAX_WEEK_CONTENT_CHARACTERS } from "./course-curriculum.js";

const MAX_SOURCE_CHARACTERS = 1000000;
const MAX_PDF_PAGES = 500;
const DAYS_PER_WEEK = 5;
const DAY_ACTIVITIES = [
  "Read today's assigned source and note important terms or steps.",
  "Summarize the main ideas from the assigned source in your own words.",
  "Practise or demonstrate one skill described in the assigned source.",
  "Apply the source material to a realistic vocational task or scenario.",
  "Review the week's learning and check your understanding with your instructor.",
];
const EXTRACTION_WARNING = "Automatic text extraction could not read this source. Daily assignments are study guidance; use the assigned pages in the original document for the lesson content.";

function curriculumError(message, status) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraphs(text) {
  const lines = cleanText(text).split(/\n+/).filter(Boolean);
  const paragraphs = [];
  let current = "";

  for (const line of lines) {
    if (isHeading(line)) {
      if (current) paragraphs.push(current);
      paragraphs.push(line);
      current = "";
    } else if (!current) {
      current = line;
    } else if (current.length < 500 && !/[.!?]["')\]]?$/.test(current)) {
      current = `${current} ${line}`;
    } else {
      paragraphs.push(current);
      current = line;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

function splitAtWordBoundary(text, maximumLength) {
  const pieces = [];
  let remaining = text.trim();
  while (remaining.length > maximumLength) {
    let splitAt = remaining.lastIndexOf(" ", maximumLength);
    if (splitAt < Math.floor(maximumLength / 2)) {
      const followingSpace = remaining.indexOf(" ", maximumLength);
      if (followingSpace <= 0) break;
      splitAt = followingSpace;
    }
    pieces.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function isHeading(text) {
  return text.length <= 100 && (
    /^(chapter|unit|module|week|block|section|lesson|topic)\b/i.test(text) ||
    (/[A-Za-z]/.test(text) && text === text.toLocaleUpperCase("en"))
  );
}

function createUnits(sections) {
  const units = [];
  for (const section of sections) {
    const text = typeof section.text === "string" ? section.text : "";
    const pageNumber = Number.isInteger(section.pageNumber) && section.pageNumber > 0
      ? section.pageNumber
      : null;
    const paragraphs = splitParagraphs(text);

    if (!paragraphs.length) {
      if (pageNumber || section.extractionUnavailable) {
        units.push({
          text: "",
          pageStart: pageNumber,
          pageEnd: pageNumber,
          sectionTitle: pageNumber ? `Page ${pageNumber}` : "Source section",
          extractionUnavailable: Boolean(section.extractionUnavailable),
        });
      }
      continue;
    }

    for (const paragraph of paragraphs) {
      units.push({
        text: paragraph,
        pageStart: pageNumber,
        pageEnd: pageNumber,
        sectionTitle: isHeading(paragraph) ? paragraph : "",
        extractionUnavailable: Boolean(section.extractionUnavailable),
      });
    }
  }
  return units;
}

function describePages(pageStart, pageEnd) {
  if (!pageStart || !pageEnd) return "";
  return pageStart === pageEnd
    ? `Source page ${pageStart}.`
    : `Source pages ${pageStart}-${pageEnd}.`;
}

function topicTitle(unit, fallback) {
  const candidate = unit.sectionTitle || unit.text;
  const title = candidate
    .split(/[\n.!?;:]/, 1)[0]
    .replace(/^(chapter|unit|module|week|block|section|lesson|topic)\s+[\w.-]+\s*[:.)-]?\s*/i, "")
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return candidate.trim() || fallback;
  return title.length > 65 ? `${title.slice(0, 62).trimEnd()}...` : title;
}

function splitLongUnits(units, maximumLength) {
  return units.flatMap((unit) => {
    if (!unit.text) return [unit];
    return splitAtWordBoundary(unit.text, maximumLength).map((text) => ({
      ...unit,
      text,
      sectionTitle: unit.sectionTitle && text === unit.text ? unit.sectionTitle : "",
    }));
  });
}

function groupUnitsByPage(units) {
  const pages = [];
  for (const unit of units) {
    const previous = pages[pages.length - 1];
    if (Number.isInteger(unit.pageStart) && previous?.pageStart === unit.pageStart) {
      if (unit.text) {
        previous.text = previous.text ? `${previous.text}\n\n${unit.text}` : unit.text;
      }
      if (!previous.sectionTitle) previous.sectionTitle = unit.sectionTitle;
      previous.extractionUnavailable ||= unit.extractionUnavailable;
    } else {
      pages.push({ ...unit });
    }
  }
  return pages;
}

function ensureUnitCount(units, unitCount, canSplitText) {
  const result = [...units];
  while (result.length < unitCount) {
    const index = result.reduce((largest, unit, candidate) =>
      unit.text.length > result[largest].text.length ? candidate : largest, 0);
    const unit = result[index];
    if (canSplitText && unit.text.length > 40) {
      const midpoint = Math.floor(unit.text.length / 2);
      let splitAt = unit.text.lastIndexOf(" ", midpoint);
      if (splitAt < 1) splitAt = unit.text.indexOf(" ", midpoint + 1);
      const pieces = splitAt > 0
        ? [unit.text.slice(0, splitAt).trim(), unit.text.slice(splitAt).trim()]
        : [];
      if (pieces.length > 1) {
        result.splice(index, 1, ...pieces.map((text) => ({
          ...unit,
          text,
          sectionTitle: "",
        })));
        continue;
      }
    }
    result.push({
      text: "",
      pageStart: null,
      pageEnd: null,
      sectionTitle: "",
      scheduleOnly: true,
    });
  }
  return result;
}

function balanceUnits(units, weekCount) {
  const weight = (unit) => Math.max(unit.text.length, 1);
  const groups = [];
  let index = 0;
  let remainingWeight = units.reduce((total, unit) => total + weight(unit), 0);

  for (let groupIndex = 0; groupIndex < weekCount; groupIndex += 1) {
    const groupsRemaining = weekCount - groupIndex;
    const unitsAvailable = units.length - index;
    const maxUnitsInGroup = unitsAvailable - groupsRemaining + 1;
    const targetWeight = remainingWeight / groupsRemaining;
    const group = [];
    let groupWeight = 0;

    while (group.length < maxUnitsInGroup) {
      const next = units[index];
      const nextWeight = weight(next);
      if (group.length && Math.abs(groupWeight - targetWeight) <=
          Math.abs(groupWeight + nextWeight - targetWeight)) {
        break;
      }
      group.push(next);
      groupWeight += nextWeight;
      index += 1;
    }
    if (!group.length) {
      group.push(units[index]);
      groupWeight = weight(units[index]);
      index += 1;
    }
    groups.push(group);
    remainingWeight -= groupWeight;
  }
  return groups;
}

function rangeFor(group) {
  const pages = group.map((unit) => unit.pageStart).filter(Number.isInteger);
  return pages.length
    ? { sourcePageStart: Math.min(...pages), sourcePageEnd: Math.max(...pages) }
    : { sourcePageStart: null, sourcePageEnd: null };
}

function pageLabel(start, end) {
  if (!start || !end) return "";
  return start === end ? `page ${start}` : `pages ${start}-${end}`;
}

function joinPdfTextItems(items) {
  const lines = [];
  let line = "";
  let previousY = null;
  let previousEndX = null;
  let previousFontSize = 12;

  const finishLine = () => {
    if (line) lines.push(line);
    line = "";
    previousY = null;
    previousEndX = null;
  };

  for (const item of items) {
    if (!item || typeof item !== "object" || typeof item.str !== "string") continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4]);
    const y = Number(transform[5]);
    const fontSize = Math.abs(Number(transform[3])) || previousFontSize;

    if (line && Number.isFinite(y) && Number.isFinite(previousY) &&
        Math.abs(y - previousY) > 2) {
      finishLine();
    }
    if (line && item.str && previousEndX !== null && Number.isFinite(x)) {
      const gap = x - previousEndX;
      if (gap > Math.max(1.5, fontSize * 0.15) && !line.endsWith(" ")) {
        line += " ";
      }
    } else if (line && item.str && previousEndX === null && !line.endsWith(" ")) {
      line += " ";
    }

    line += item.str;
    previousY = Number.isFinite(y) ? y : previousY;
    previousEndX = Number.isFinite(x) && Number.isFinite(Number(item.width))
      ? x + Number(item.width)
      : null;
    previousFontSize = fontSize;
    if (item.hasEOL) finishLine();
  }
  finishLine();
  return lines.join("\n");
}

export function buildDocumentCurriculumFromSections({
  documentTitle,
  filename,
  moduleCount,
  sections,
  sourceExtractionFallback = false,
}) {
  if (!Number.isInteger(moduleCount) || moduleCount < 1 || moduleCount > 8) {
    throw curriculumError("Choose a course duration between 1 and 8 modules.", 400);
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    throw curriculumError("No readable content or pages were found in this document.", 422);
  }

  const weekCount = moduleCount * 4;
  const dayCount = weekCount * DAYS_PER_WEEK;
  const units = createUnits(sections);
  if (!units.length) {
    throw curriculumError("No readable content or pages were found in this document.", 422);
  }
  const sourceCharacters = units.reduce((total, unit) => total + unit.text.length, 0);
  const sourceTextAvailable = units.some((unit) => unit.text);
  if (sourceCharacters > MAX_SOURCE_CHARACTERS) {
    throw curriculumError("This document contains too much text to arrange in one curriculum. Split it into smaller documents and try again.", 413);
  }
  const maximumSourceLength = MAX_WEEK_CONTENT_CHARACTERS -
    DAYS_PER_WEEK * (Math.max(...DAY_ACTIVITIES.map((activity) => activity.length)) + 100);
  if (sourceCharacters > maximumSourceLength * weekCount) {
    throw curriculumError(
      `The document has more text than ${moduleCount} modules can fit. Choose more modules or split the source document.`,
      413,
    );
  }

  const targetLength = Math.max(1, Math.ceil(sourceCharacters / dayCount));
  const isPaginatedSource = path.extname(filename).toLowerCase() === ".pdf";
  const dailyUnits = isPaginatedSource
    ? groupUnitsByPage(units)
    : splitLongUnits(units, Math.max(40, Math.floor(targetLength / 2)));
  const preparedUnits = ensureUnitCount(
    dailyUnits,
    dayCount,
    !isPaginatedSource,
  );
  const dayGroups = balanceUnits(preparedUnits, dayCount);
  const days = dayGroups.map((group, dayIndex) => {
    const pages = rangeFor(group);
    const pageText = pageLabel(pages.sourcePageStart, pages.sourcePageEnd);
    const sourceExcerpt = group.map((unit) => unit.text).filter(Boolean).join("\n\n").trim();
    const extractionUnavailable = sourceExtractionFallback ||
      group.some((unit) => unit.extractionUnavailable);
    const scheduleOnly = group.every((unit) => unit.scheduleOnly);
    const activity = DAY_ACTIVITIES[dayIndex % DAYS_PER_WEEK];
    const lessonContent = sourceExcerpt
      ? `${sourceExcerpt}\n\nActivity: ${activity}`
      : scheduleOnly
        ? `Continue working through the approved source. Review key ideas, practise a skill from the material, or ask your instructor for guidance on an applied task.\n\nActivity: ${activity}`
      : extractionUnavailable
        ? `Open the original document and study ${pageText || "the next assigned portion of the source"}. Text extraction was unavailable, so use the assigned page(s) as the lesson content.\n\nActivity: ${activity}`
        : `Open the approved document and review ${pageText || "the assigned source section"}. Inspect its diagrams, tables, images, or scanned pages and discuss their key points with your instructor.\n\nActivity: ${activity}`;

    return {
      dayNumber: (dayIndex % DAYS_PER_WEEK) + 1,
      title: `Day ${(dayIndex % DAYS_PER_WEEK) + 1}`,
      sourcePageStart: pages.sourcePageStart,
      sourcePageEnd: pages.sourcePageEnd,
      lessonContent,
      pageText,
      topic: topicTitle(
        group.find((unit) => unit.text && !unit.sectionTitle) ||
          group.find((unit) => unit.sectionTitle || unit.text) || group[0],
        pageText ? `Assigned ${pageText}` : `Source segment ${dayIndex + 1}`,
      ),
    };
  });
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekDays = days.slice(weekIndex * DAYS_PER_WEEK, (weekIndex + 1) * DAYS_PER_WEEK);
    const weekGroups = dayGroups.slice(weekIndex * DAYS_PER_WEEK, (weekIndex + 1) * DAYS_PER_WEEK);
    const pages = rangeFor(weekGroups.flat());
    const titleSource = weekGroups.flat().find((unit) => unit.text && !unit.sectionTitle) ||
      weekGroups.flat().find((unit) => unit.sectionTitle || unit.text) || weekGroups[0][0];
    const pageText = pageLabel(pages.sourcePageStart, pages.sourcePageEnd);
    const topic = sourceTextAvailable
      ? topicTitle(titleSource, pageText ? `Assigned ${pageText}` : `Source segment ${weekIndex + 1}`)
      : pageText
        ? `Source ${pageText}`
        : "Assigned source section";
    const lessonContent = weekDays.map((day) => {
      const dailyPageText = day.pageText ? `Source ${day.pageText}` : "Assigned source section";
      return `Day ${day.dayNumber} | ${dailyPageText}\n${day.lessonContent}`;
    }).join("\n\n");
    const description = [
      describePages(pages.sourcePageStart, pages.sourcePageEnd),
      "Study the source material in order across five daily learning blocks.",
    ].filter(Boolean).join(" ");

    if (lessonContent.length > MAX_WEEK_CONTENT_CHARACTERS) {
      throw curriculumError(
        `The source segment for Week ${weekIndex + 1} is too large. Choose more modules so the document can be divided into smaller blocks.`,
        413,
      );
    }

    return {
      title: `Week ${weekIndex + 1}: ${topic}`.slice(0, 120),
      description,
      learningObjectives: "Identify the main ideas in the assigned source, explain its key concepts or procedures, and apply them to a practical vocational task.",
      lessonContent,
      days: weekDays.map(({ pageText: _pageText, topic: _topic, ...day }) => day),
      ...pages,
      topic,
    };
  });

  return {
    ...(sourceExtractionFallback ? { sourceExtractionFallback: true } : {}),
    modules: Array.from({ length: moduleCount }, (_, moduleIndex) => {
      const moduleWeeks = weeks.slice(moduleIndex * 4, moduleIndex * 4 + 4);
      const moduleNumber = moduleIndex + 1;
      const firstTopic = moduleWeeks[0].topic;
      const moduleDays = dayGroups.slice(
        moduleIndex * 4 * DAYS_PER_WEEK,
        (moduleIndex + 1) * 4 * DAYS_PER_WEEK,
      );
      const modulePages = rangeFor(moduleDays.flat());
      const pagesDescription = describePages(modulePages.sourcePageStart, modulePages.sourcePageEnd);
      const moduleTopic = sourceTextAvailable
        ? firstTopic
        : modulePages.sourcePageStart
          ? `Source ${pageLabel(modulePages.sourcePageStart, modulePages.sourcePageEnd)}`
          : "Course materials";
      const moduleTitle = moduleTopic.slice(0, 120);
      const capstonePrompt = `At the end of Week 4, complete a practical capstone using Weeks 1-4 of Module ${moduleNumber} (${moduleTitle}). Produce a vocational deliverable that applies the module's key ideas or procedures, and explain how the source informed your decisions.`;

      return {
        title: moduleTitle,
        description: [
          `Four weeks of guided learning based on ${documentTitle || filename}.`,
          pagesDescription,
          sourceExtractionFallback ? EXTRACTION_WARNING : "",
        ].filter(Boolean).join(" "),
        capstonePrompt,
        weeks: moduleWeeks.map(({ topic, ...week }) => week),
      };
    }),
  };
}

function inspectPdfPageCount(sourceBytes) {
  const bytes = Buffer.from(sourceBytes);
  const sample = bytes.subarray(0, 1024).toString("latin1");
  if (!sample.includes("%PDF-")) return { isPdf: false, pageCount: null };

  const source = bytes.toString("latin1");
  const declaredCounts = Array.from(
    source.matchAll(/\/Type\s*\/Pages\b([\s\S]{0,2048}?)\/Count\s+(\d+)/g),
    (match) => Number(match[2]),
  ).filter((count) => Number.isInteger(count) && count > 0);
  const pageCount = declaredCounts.length
    ? declaredCounts.reduce((largest, count) => Math.max(largest, count), 0)
    : Array.from(source.matchAll(/\/Type\s*\/Page(?!s)(?=\s|\/|>)/g)).length || null;
  return { isPdf: true, pageCount };
}

async function extractPdfSections(sourceBytes) {
  let loadingTask;
  let pageCount = null;
  const sections = [];
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(sourceBytes),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    pageCount = pdf.numPages;
    if (!pageCount) throw new Error("The PDF contains no pages.");
    if (pageCount > MAX_PDF_PAGES) {
      throw curriculumError(`This PDF has more than ${MAX_PDF_PAGES} pages. Split it into smaller documents and try again.`, 413);
    }

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = cleanText(joinPdfTextItems(content.items));
      sections.push({ pageNumber, text });
    }
    return { sections, sourceExtractionFallback: false };
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
    const inspection = inspectPdfPageCount(sourceBytes);
    if (!inspection.isPdf) {
      throw curriculumError("The uploaded file does not contain a readable PDF header.", 422);
    }
    pageCount = pageCount || inspection.pageCount;
    if (pageCount && pageCount > MAX_PDF_PAGES) {
      throw curriculumError(`This PDF has more than ${MAX_PDF_PAGES} pages. Split it into smaller documents and try again.`, 413);
    }
    const fallbackSections = pageCount
      ? Array.from({ length: pageCount }, (_, index) => ({
          pageNumber: index + 1,
          text: "",
          extractionUnavailable: true,
        }))
      : [{ pageNumber: null, text: "", extractionUnavailable: true }];
    return { sections: fallbackSections, sourceExtractionFallback: true };
  } finally {
    if (loadingTask) await loadingTask.destroy();
  }
}

async function extractDocxSections(sourceBytes) {
  let extracted;
  try {
    extracted = await mammoth.extractRawText({ buffer: sourceBytes });
  } catch {
    return { sections: [{ text: "", extractionUnavailable: true }], sourceExtractionFallback: true };
  }
  const text = cleanText(extracted.value);
  if (!text) {
    return { sections: [{ text: "", extractionUnavailable: true }], sourceExtractionFallback: true };
  }
  return { sections: [{ text }], sourceExtractionFallback: false };
}

export async function buildDocumentCurriculum({
  filename,
  sourceBytes,
  documentTitle,
  moduleCount,
}) {
  const extension = path.extname(filename).toLowerCase();
  let extracted;
  if (extension === ".pdf") {
    extracted = await extractPdfSections(sourceBytes);
  } else if (extension === ".docx") {
    extracted = await extractDocxSections(sourceBytes);
  } else {
    throw curriculumError("Document curricula are available for PDF and DOCX files only.", 400);
  }

  return buildDocumentCurriculumFromSections({
    documentTitle,
    filename,
    moduleCount,
    sections: extracted.sections,
    sourceExtractionFallback: extracted.sourceExtractionFallback,
  });
}
