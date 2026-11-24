import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCloudinarySignature, validateLocation } from "./location-validation.js";
import {
  getPrivateCloudinaryUploadMismatches,
  getPrivateFileType,
} from "./private-file-validation.js";
import {
  ACCOUNT_ROLES,
  generateTemporaryPassword,
  hashPassword,
  validateAccount,
  validateAccountPassword,
  validateAccountReview,
  verifyPassword,
} from "./account-security.js";
import {
  SITE_SETTING_DEFAULTS,
  isValidAccentColor,
  validateSiteSettings,
} from "./site-settings.js";
import {
  getBoardGroups,
  getNextInstallmentPayment,
  validateBoardMember,
  validateLiveClass,
  validateModule,
  validateProgrammePaymentPlan,
  validateProgramme,
  validateTeacherProfile,
  validateWhiteboardStrokes,
} from "./learning-validation.js";

const validLocation = {
  city: "  Buea  ",
  region: "Southwest Region",
  address: "",
  description: "",
  imageUrl: "",
  isActive: true,
  sortOrder: 4,
};

test("validates and normalizes location details", () => {
  assert.deepEqual(validateLocation(validLocation, "demo-cloud"), {
    location: {
      city: "Buea",
      region: "Southwest Region",
      address: "",
      description: "",
      isActive: true,
      sortOrder: 4,
      imageUrl: "",
    },
  });
});

test("rejects missing cities, oversized fields, and invalid ordering", () => {
  assert.ok(validateLocation({ ...validLocation, city: "  " }, "cloud").error);
  assert.ok(validateLocation({ ...validLocation, region: "r".repeat(101) }, "cloud").error);
  assert.ok(validateLocation({ ...validLocation, sortOrder: 1.5 }, "cloud").error);
  assert.ok(validateLocation({ ...validLocation, isActive: "true" }, "cloud").error);
});

test("accepts HTTPS images only from the configured Cloudinary account", () => {
  const imageUrl = "https://res.cloudinary.com/demo-cloud/image/upload/v1/tgfvp/locations/buea.jpg";
  assert.equal(
    validateLocation({ ...validLocation, imageUrl }, "demo-cloud").location.imageUrl,
    imageUrl,
  );
  assert.ok(validateLocation({ ...validLocation, imageUrl }, "different-cloud").error);
  assert.ok(
    validateLocation(
      { ...validLocation, imageUrl: "https://example.com/location.jpg" },
      "demo-cloud",
    ).error,
  );
  assert.ok(
    validateLocation({ ...validLocation, imageUrl: "javascript:alert(1)" }, "demo-cloud").error,
  );
});

test("creates Cloudinary's signed-upload SHA-1 signature from sorted parameters", () => {
  const apiSecret = "test-secret";
  const expected = createHash("sha1")
    .update(`folder=tgfvp/locations&timestamp=1700000000&upload_preset=TGFUP${apiSecret}`)
    .digest("hex");
  assert.equal(
    createCloudinarySignature({
      folder: "tgfvp/locations",
      timestamp: 1700000000,
      uploadPreset: "TGFUP",
      apiSecret,
    }),
    expected,
  );
  assert.throws(
    () =>
      createCloudinarySignature({
        folder: "tgfvp/locations",
        timestamp: 1.5,
        uploadPreset: "TGFUP",
        apiSecret,
      }),
    TypeError,
  );
});

test("validates private material documents, images and videos by type and signature", () => {
  assert.deepEqual(
    getPrivateFileType(".pdf", "application/pdf", new TextEncoder().encode("%PDF-1.7")),
    { contentType: "application/pdf", format: "pdf" },
  );
  assert.deepEqual(
    getPrivateFileType(".mp4", "video/mp4", new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), true),
    { contentType: "video/mp4", format: "mp4" },
  );
  assert.deepEqual(
    getPrivateFileType(".webp", "image/webp", new TextEncoder().encode("RIFF1234WEBP"), true),
    { contentType: "image/webp", format: "webp" },
  );
  assert.equal(
    getPrivateFileType(".mp4", "video/mp4", new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])),
    null,
  );
  assert.equal(
    getPrivateFileType(".pdf", "application/pdf", new TextEncoder().encode("not a PDF")),
    null,
  );
});

test("verifies private Cloudinary uploads without relying on raw asset format metadata", () => {
  assert.deepEqual(
    getPrivateCloudinaryUploadMismatches({
      public_id: "tgfvp/private/learning-materials/teacher/file.pdf",
      resource_type: "raw",
      type: "authenticated",
      format: "",
      bytes: 42,
    }, "tgfvp/private/learning-materials/teacher/file.pdf", 42),
    [],
  );
  assert.deepEqual(
    getPrivateCloudinaryUploadMismatches({
      public_id: "unexpected",
      resource_type: "raw",
      type: "upload",
      bytes: 41,
    }, "tgfvp/private/learning-materials/teacher/file.pdf", 42),
    ["public_id", "type", "bytes"],
  );
});

test("seeds the four requested Cameroon locations", async () => {
  const migration = await readFile(
    new URL("../db/migrations/001_locations.sql", import.meta.url),
    "utf8",
  );
  for (const city of ["Bamenda", "Yaounde", "Douala", "Buea"]) {
    assert.match(migration, new RegExp(`'${city}'`));
  }
});

test("hashes passwords with unique salts and verifies them safely", () => {
  const firstHash = hashPassword("test-password-with-more-than-fourteen-chars");
  const secondHash = hashPassword("test-password-with-more-than-fourteen-chars");
  assert.notEqual(firstHash, secondHash);
  assert.equal(verifyPassword("test-password-with-more-than-fourteen-chars", firstHash), true);
  assert.equal(verifyPassword("a-wrong-password", firstHash), false);
  assert.equal(verifyPassword("password", "malformed"), false);
});

test("validates account roles without exposing main-administrator privilege", () => {
  const validation = validateAccount({
    fullName: "  A TGF Manager  ",
    email: " Manager@example.com ",
    role: "subsidiary_manager",
    subsidiary: "best_rides",
  });
  assert.deepEqual(validation, {
    account: {
      fullName: "A TGF Manager",
      email: "manager@example.com",
      role: "subsidiary_manager",
      subsidiary: "best_rides",
    },
  });
  assert.ok(
    validateAccount({
      fullName: "TGF Manager",
      email: "manager@example.com",
      role: "super_admin",
      subsidiary: "best_rides",
    }).error,
  );
  assert.ok(
    validateAccount({
      fullName: "TGF Manager",
      email: "invalid",
      role: "operations",
      subsidiary: "best_rides",
    }).error,
  );
  assert.deepEqual(ACCOUNT_ROLES, [
    "administrator",
    "executive",
    "subsidiary_manager",
    "supervisor",
    "operations",
    "teacher",
    "learner",
  ]);
});

test("validates teacher accounts for the vocational pathways team", () => {
  assert.deepEqual(
    validateAccount({
      fullName: "A TGF Teacher",
      email: "teacher@example.com",
      role: "teacher",
      subsidiary: "tgfvp",
    }),
    {
      account: {
        fullName: "A TGF Teacher",
        email: "teacher@example.com",
        role: "teacher",
        subsidiary: "tgfvp",
      },
    },
  );
});

test("validates admin-selected passwords with the sign-in password policy", () => {
  assert.deepEqual(validateAccountPassword("fourteen-chars"), { password: "fourteen-chars" });
  assert.ok(validateAccountPassword("short").error);
  assert.ok(validateAccountPassword("x".repeat(1025)).error);
  assert.ok(validateAccountPassword(null).error);
});

test("requires a meaningful reason for rejecting learner accounts", () => {
  assert.deepEqual(validateAccountReview({ action: "approve" }), {
    review: { action: "approve", reason: "" },
  });
  assert.deepEqual(validateAccountReview({ action: "reject", reason: "  Missing documents  " }), {
    review: { action: "reject", reason: "Missing documents" },
  });
  assert.ok(validateAccountReview({ action: "reject", reason: " no " }).error);
  assert.ok(validateAccountReview({ action: "reject", reason: "x".repeat(501) }).error);
  assert.ok(validateAccountReview({ action: "unknown" }).error);
});

test("generates one-time account passwords of sufficient length", () => {
  const password = generateTemporaryPassword();
  assert.ok(password.length >= 32);
  assert.notEqual(password, generateTemporaryPassword());
});

test("validates resumption dates, readable colors, and account-owned flyer URLs", () => {
  const valid = {
    resumptionDate: "2027-01-15",
    resumptionLabel: "Training resumes",
    accentColor: "#F47D20",
    flyerImageUrl:
      "https://res.cloudinary.com/demo-cloud/image/upload/tgfvp/flyers/resumption-2027.jpg",
    flyerDateText: "January 15 to February 28",
  };
  assert.equal(validateSiteSettings(valid, "demo-cloud").settings.resumptionDate, "2027-01-15");
  assert.equal(validateSiteSettings(valid, "demo-cloud").settings.accentColor, "#F47D20");
  assert.equal(validateSiteSettings(valid, "demo-cloud").settings.flyerDateText, "JANUARY 15 TO FEBRUARY 28");
  assert.equal(
    validateSiteSettings({ ...valid, flyerImageUrl: SITE_SETTING_DEFAULTS.flyerImageUrl }, "demo-cloud")
      .settings.flyerImageUrl,
    SITE_SETTING_DEFAULTS.flyerImageUrl,
  );
  assert.equal(isValidAccentColor("#F47D20"), true);
  assert.equal(isValidAccentColor("#FFFFFF"), false);
  assert.ok(validateSiteSettings({ ...valid, resumptionDate: "2027-02-30" }, "demo-cloud").error);
  assert.ok(validateSiteSettings({ ...valid, accentColor: "#FFFFFF" }, "demo-cloud").error);
  assert.ok(validateSiteSettings({ ...valid, flyerDateText: " " }, "demo-cloud").error);
  assert.ok(
    validateSiteSettings(
      { ...valid, flyerImageUrl: "https://res.cloudinary.com/other/image/upload/flyer.jpg" },
      "demo-cloud",
    ).error,
  );
});

test("validates hierarchical board profiles and TGF-owned photos", () => {
  const member = {
    fullName: "  Board Member  ",
    positionTitle: "Chairperson of the Board",
    hierarchyGroup: "Board of Directors",
    biography: "A short professional profile.",
    photoUrl:
      "https://res.cloudinary.com/demo-cloud/image/upload/tgfvp/board/chairperson.jpg",
    sortOrder: 1,
    isActive: true,
  };
  assert.equal(validateBoardMember(member, "demo-cloud").member.fullName, "Board Member");
  assert.equal(getBoardGroups()[0], "Board of Directors");
  assert.ok(validateBoardMember({ ...member, hierarchyGroup: "Unlisted" }, "demo-cloud").error);
  assert.ok(
    validateBoardMember(
      { ...member, photoUrl: "https://example.com/photo.jpg" },
      "demo-cloud",
    ).error,
  );
});

test("validates teacher-submitted profile details within publication limits", () => {
  assert.deepEqual(validateTeacherProfile({
    title: "Electrical Installation Tutor",
    biography: "An experienced vocational teacher focused on practical skills.",
    qualifications: "Diploma in Electrical Engineering",
  }), {
    profile: {
      title: "Electrical Installation Tutor",
      biography: "An experienced vocational teacher focused on practical skills.",
      qualifications: "Diploma in Electrical Engineering",
    },
  });
  assert.ok(validateTeacherProfile({
    title: "t".repeat(121),
    biography: "",
    qualifications: "",
  }).error);
  assert.ok(validateTeacherProfile({
    title: "",
    biography: "b".repeat(2001),
    qualifications: "",
  }).error);
  assert.ok(validateTeacherProfile({
    title: "",
    biography: "",
    qualifications: "q".repeat(1201),
  }).error);
  assert.deepEqual(validateTeacherProfile({
    title: "",
    biography: "A teacher biography with enough detail.",
    qualifications: "",
    photoUrl: "https://res.cloudinary.com/demo-cloud/image/upload/tgfvp/teacher-profiles/123/photo.jpg",
  }, "demo-cloud", "123"), {
    profile: {
      title: "",
      biography: "A teacher biography with enough detail.",
      qualifications: "",
      photoUrl: "https://res.cloudinary.com/demo-cloud/image/upload/tgfvp/teacher-profiles/123/photo.jpg",
    },
  });
  assert.ok(validateTeacherProfile({
    title: "",
    biography: "",
    qualifications: "",
    photoUrl: "https://example.com/photo.jpg",
  }, "demo-cloud", "123").error);
  assert.ok(validateTeacherProfile({
    title: "",
    biography: "",
    qualifications: "",
    photoUrl: 123,
  }, "demo-cloud", "123").error);
  assert.ok(validateTeacherProfile({
    title: "",
    biography: "",
    qualifications: "",
    photoUrl: "https://res.cloudinary.com/demo-cloud/image/upload/tgfvp/teacher-profiles/456/photo.jpg",
  }, "demo-cloud", "123").error);
});



test("validates programme payment plans against fee and ordered installment totals", () => {
  const plan = {
    totalFee: 250000,
    paymentInstructions: "Pay using the account details provided by the office.",
    installments: [
      { label: "Registration fee", paymentCategory: "registration", amount: 50000, dueDaysAfterEnrollment: 0 },
      { label: "Course balance", amount: 200000, dueDaysAfterEnrollment: 30 },
    ],
  };
  assert.equal(validateProgrammePaymentPlan(plan, 50000).paymentPlan.installments.length, 2);
  assert.ok(validateProgrammePaymentPlan(plan, 300000).error);
  assert.ok(validateProgrammePaymentPlan({ ...plan, totalFee: 260000 }).error);
  assert.ok(validateProgrammePaymentPlan({
    ...plan,
    installments: [{ label: "Course balance", amount: 250000, dueDaysAfterEnrollment: 0 }],
  }, 50000).error);
  assert.ok(validateProgrammePaymentPlan({
    ...plan,
    installments: [plan.installments[1], plan.installments[0]],
  }).error);
  assert.deepEqual(validateProgrammePaymentPlan({
    totalFee: 0,
    paymentInstructions: "",
    installments: [],
  }).paymentPlan.installments, []);
});

test("validates registration followed by three installments", () => {
  const plan = validateProgrammePaymentPlan({
    totalFee: 50000,
    paymentInstructions: "",
    installments: [
      { label: "Registration fee", paymentCategory: "registration", amount: 5000, dueDaysAfterEnrollment: 0 },
      { label: "First installment", paymentCategory: "installment", amount: 15000, dueDaysAfterEnrollment: 0 },
      { label: "Second installment", paymentCategory: "installment", amount: 15000, dueDaysAfterEnrollment: 30 },
      { label: "Third installment", paymentCategory: "installment", amount: 15000, dueDaysAfterEnrollment: 60 },
    ],
  }, 5000);
  assert.equal(plan.paymentPlan.installments[0].paymentCategory, "registration");
  assert.equal(plan.paymentPlan.installments.length, 4);
  assert.ok(validateProgrammePaymentPlan({
    ...plan.paymentPlan,
    installments: [
      { ...plan.paymentPlan.installments[0], amount: 4000 },
      ...plan.paymentPlan.installments.slice(1),
    ],
  }, 5000).error);
});

test("calculates the next unpaid installment and its remaining amount", () => {
  const installments = [
    { sequenceNumber: 1, amount: 1000 },
    { sequenceNumber: 2, amount: 1000 },
    { sequenceNumber: 3, amount: 1000 },
  ];
  assert.deepEqual(getNextInstallmentPayment(installments, 0, 3000), {
    sequenceNumber: 1,
    amount: 1000,
  });
  assert.deepEqual(getNextInstallmentPayment(installments, 1500, 3000), {
    sequenceNumber: 2,
    amount: 500,
  });
  assert.deepEqual(getNextInstallmentPayment(installments, 2000, 3000), {
    sequenceNumber: 3,
    amount: 1000,
  });
  assert.equal(getNextInstallmentPayment(installments, 3000, 3000), null);
});

test("validates ordered learning modules, secure live classes, and whiteboard strokes", () => {
  const module = {
    title: "Module one",
    description: "Introduction",
    lessonContent: "Start here.",
    meetingUrl: "https://meet.example.test/room",
    position: 1,
    isReleased: true,
  };
  assert.equal(validateModule(module).module.position, 1);
  assert.ok(validateModule({ ...module, meetingUrl: "http://insecure.example.test" }).error);
  const programme = validateProgramme({
    title: "Software Engineering",
    description: "Build software skills.",
    sortOrder: 1,
    isActive: true,
  });
  assert.equal(programme.programme.registrationFee, 0);
  assert.equal(validateProgramme({
    title: "Software Engineering",
    description: "Build software skills.",
    sortOrder: 1,
    isActive: true,
    registrationFee: 250000,
  }).programme.registrationFee, 250000);
  assert.ok(validateProgramme({
    title: "Software Engineering",
    description: "Build software skills.",
    sortOrder: 1,
    isActive: true,
    registrationFee: -1,
  }).error);
  assert.ok(validateProgramme({
    title: "Software Engineering",
    description: "Build software skills.",
    sortOrder: 1,
    isActive: true,
    registrationFee: 1.5,
  }).error);
  assert.ok(validateLiveClass({
    moduleId: "123e4567-e89b-12d3-a456-426614174000",
    title: "Live session",
    meetingUrl: "https://meet.example.test/class",
    startsAt: "2027-01-15T10:00:00Z",
  }).liveClass);
  assert.equal(validateLiveClass({
    moduleId: "123e4567-e89b-12d3-a456-426614174000",
    title: "Training session",
    deliveryMode: "location",
    locationId: "123e4567-e89b-12d3-a456-426614174001",
    startsAt: "2027-01-15T10:00:00Z",
  }).liveClass.deliveryMode, "location");
  assert.ok(validateLiveClass({
    moduleId: "123e4567-e89b-12d3-a456-426614174000",
    title: "Training session",
    deliveryMode: "venue",
    venue: "",
    startsAt: "2027-01-15T10:00:00Z",
  }).error);
  assert.deepEqual(
    validateWhiteboardStrokes([
      { color: "#123456", width: 3, points: [{ x: 0.1, y: 0.4 }, { x: 0.7, y: 0.9 }] },
    ]).strokes[0].points.length,
    2,
  );
  assert.ok(validateWhiteboardStrokes([{ color: "red", width: 3, points: [{ x: 0, y: 0 }] }]).error);
});
