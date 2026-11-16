import assert from "node:assert/strict";
import test from "node:test";

import { validatePublicSubmission } from "./public-submissions-validation.js";

const consent = {
  fullName: "Amina N.",
  email: "amina@example.com",
  consent: true,
};

test("validates and normalizes a community registration with optional newsletter consent", () => {
  const result = validatePublicSubmission("community", {
    ...consent,
    fullName: "  Amina N. ",
    location: "Douala",
    newsletterOptIn: true,
  });

  assert.deepEqual(result, {
    submission: {
      type: "community",
      fullName: "Amina N.",
      email: "amina@example.com",
      phone: "",
      location: "Douala",
      subject: "",
      message: "",
      newsletterOptIn: true,
    },
  });
});

test("requires valid consent, name and email before accepting a submission", () => {
  assert.match(validatePublicSubmission("contact", { ...consent, consent: false }).error, /consent/i);
  assert.match(validatePublicSubmission("contact", { ...consent, fullName: "A" }).error, /Full name/);
  assert.match(validatePublicSubmission("contact", { ...consent, email: "not-an-email" }).error, /valid email/i);
});

test("requires a useful enquiry message and a career area of interest", () => {
  assert.match(
    validatePublicSubmission("contact", { ...consent, subject: "Question", message: "Short" }).error,
    /at least 10 characters/i,
  );
  assert.match(
    validatePublicSubmission("career", { ...consent, subject: "" }).error,
    /Area of interest/i,
  );
});

test("rejects unknown submission types and overlong optional fields", () => {
  assert.match(validatePublicSubmission("other", consent).error, /invalid/i);
  assert.match(
    validatePublicSubmission("community", { ...consent, location: "x".repeat(101) }).error,
    /100 characters/i,
  );
});
