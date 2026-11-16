import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CORPORATE_CONTENT,
  validateCorporateContent,
} from "./corporate-content-validation.js";

test("the verified default corporate content is valid", () => {
  const result = validateCorporateContent(DEFAULT_CORPORATE_CONTENT);

  assert.equal(result.error, undefined);
  assert.equal(result.content.about.values.length, 5);
  assert.equal(result.content.tgfea.awardCategories.length, 34);
});

test("corporate content rejects an unsafe subsidiary website URL", () => {
  const content = structuredClone(DEFAULT_CORPORATE_CONTENT);
  content.subsidiaries[0].website = "javascript:alert(1)";

  assert.match(validateCorporateContent(content).error, /HTTP or HTTPS/);
});

test("corporate content rejects invalid media types and missing vacancy details", () => {
  const invalidMedia = structuredClone(DEFAULT_CORPORATE_CONTENT);
  invalidMedia.newsroom.items = [{
    type: "script",
    title: "Update",
    date: "",
    summary: "A verified update.",
    link: "",
    imageUrl: "",
  }];
  assert.match(validateCorporateContent(invalidMedia).error, /valid media type/);

  const invalidVacancy = structuredClone(DEFAULT_CORPORATE_CONTENT);
  invalidVacancy.careers.vacancies = [{
    title: "Programme officer",
    location: "",
    type: "",
    deadline: "",
    description: "",
    requirements: "",
    active: true,
  }];
  assert.match(validateCorporateContent(invalidVacancy).error, /description is required/);
});

test("corporate content rejects oversized lists", () => {
  const content = structuredClone(DEFAULT_CORPORATE_CONTENT);
  content.community.points = Array(31).fill("An update");

  assert.match(validateCorporateContent(content).error, /no more than 30/);
});
