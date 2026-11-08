import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCloudinarySignature, validateLocation } from "./location-validation.js";
import {
  ACCOUNT_ROLES,
  generateTemporaryPassword,
  hashPassword,
  validateAccount,
  verifyPassword,
} from "./account-security.js";
import {
  SITE_SETTING_DEFAULTS,
  isValidAccentColor,
  validateSiteSettings,
} from "./site-settings.js";

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
    "learner",
  ]);
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
  };
  assert.equal(validateSiteSettings(valid, "demo-cloud").settings.resumptionDate, "2027-01-15");
  assert.equal(validateSiteSettings(valid, "demo-cloud").settings.accentColor, "#F47D20");
  assert.equal(
    validateSiteSettings({ ...valid, flyerImageUrl: SITE_SETTING_DEFAULTS.flyerImageUrl }, "demo-cloud")
      .settings.flyerImageUrl,
    SITE_SETTING_DEFAULTS.flyerImageUrl,
  );
  assert.equal(isValidAccentColor("#F47D20"), true);
  assert.equal(isValidAccentColor("#FFFFFF"), false);
  assert.ok(validateSiteSettings({ ...valid, resumptionDate: "2027-02-30" }, "demo-cloud").error);
  assert.ok(validateSiteSettings({ ...valid, accentColor: "#FFFFFF" }, "demo-cloud").error);
  assert.ok(
    validateSiteSettings(
      { ...valid, flyerImageUrl: "https://res.cloudinary.com/other/image/upload/flyer.jpg" },
      "demo-cloud",
    ).error,
  );
});
