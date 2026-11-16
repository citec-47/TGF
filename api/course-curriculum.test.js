import test from "node:test";
import assert from "node:assert/strict";
import { validateGeneratedCurriculum } from "./course-curriculum.js";

function validModule() {
  return {
    title: "Foundations",
    description: "Core ideas for the course.",
    capstonePrompt: "Create a practical project that demonstrates the course skills.",
    weeks: Array.from({ length: 4 }, (_, index) => ({
      title: `Week ${index + 1}`,
      description: "Study the key concepts and apply them.",
      learningObjectives: "Explain the concepts and use them in a practical task.",
      lessonContent: "Read this lesson, practise the steps, and check your understanding.",
    })),
  };
}

test("accepts and normalizes a curriculum with the requested module count", () => {
  const result = validateGeneratedCurriculum({
    modules: [{ ...validModule(), title: "  Foundations  " }],
  }, 1);

  assert.equal(result.error, undefined);
  assert.equal(result.curriculum.modules[0].title, "Foundations");
  assert.equal(result.curriculum.modules[0].weeks.length, 4);
});

test("rejects a generated curriculum with the wrong number of modules or weeks", () => {
  assert.match(
    validateGeneratedCurriculum({ modules: [validModule()] }, 2).error,
    /exactly 2 modules/,
  );
  assert.match(
    validateGeneratedCurriculum({
      modules: [{ ...validModule(), weeks: validModule().weeks.slice(0, 3) }],
    }, 1).error,
    /four weekly blocks/,
  );
});

test("rejects a block without student-facing lesson content", () => {
  const module = validModule();
  module.weeks[2].lessonContent = "too short";

  assert.match(
    validateGeneratedCurriculum({ modules: [module] }, 1).error,
    /week 3 has invalid lesson details/,
  );
});

test("preserves valid source page ranges and rejects inconsistent ranges", () => {
  const module = validModule();
  module.weeks[0].sourcePageStart = 3;
  module.weeks[0].sourcePageEnd = 5;

  const result = validateGeneratedCurriculum({ modules: [module] }, 1);
  assert.equal(result.curriculum.modules[0].weeks[0].sourcePageStart, 3);
  assert.equal(result.curriculum.modules[0].weeks[0].sourcePageEnd, 5);

  module.weeks[0].sourcePageEnd = 2;
  assert.match(
    validateGeneratedCurriculum({ modules: [module] }, 1).error,
    /week 1 has invalid lesson details/,
  );
});

test("preserves five ordered study days and the source extraction warning", () => {
  const module = validModule();
  module.weeks[0].days = Array.from({ length: 5 }, (_, index) => ({
    dayNumber: index + 1,
    title: `Day ${index + 1}`,
    lessonContent: `Study source page ${index + 1} and complete the daily activity.`,
    sourcePageStart: index + 1,
    sourcePageEnd: index + 1,
  }));
  const result = validateGeneratedCurriculum({
    sourceExtractionFallback: true,
    modules: [module],
  }, 1);

  assert.equal(result.curriculum.sourceExtractionFallback, true);
  assert.equal(result.curriculum.modules[0].weeks[0].days.length, 5);
  assert.equal(result.curriculum.modules[0].weeks[0].days[4].sourcePageStart, 5);

  module.weeks[0].days.pop();
  assert.match(
    validateGeneratedCurriculum({ modules: [module] }, 1).error,
    /must contain five study days/,
  );
});

