import assert from "node:assert/strict";
import test from "node:test";
import { validateAccount } from "./account-security.js";

const account = {
  fullName: "Live Class Tutor",
  email: "tutor@example.com",
  role: "teacher",
  subsidiary: "tgfvp",
};

test("validates optional gender values for account creation", () => {
  assert.equal(validateAccount({ ...account, gender: "male" }).account.gender, "male");
  assert.equal(validateAccount({ ...account, gender: "female" }).account.gender, "female");
  assert.equal(validateAccount({ ...account, gender: "unspecified" }).account.gender, "unspecified");
  assert.match(validateAccount({ ...account, gender: "other" }).error, /gender/i);
  assert.equal(validateAccount(account).account.gender, undefined);
});
