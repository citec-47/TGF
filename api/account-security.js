import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ACCOUNT_ROLES = Object.freeze([
  "administrator",
  "executive",
  "subsidiary_manager",
  "supervisor",
  "operations",
  "teacher",
  "learner",
]);

export const SUBSIDIARIES = Object.freeze([
  "central_administration",
  "best_rides",
  "dehivas",
  "tgf_supersales",
  "tgfvp",
]);

const PASSWORD_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, PASSWORD_LENGTH);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") return false;
  const [saltString, hashString, ...extra] = storedHash.split(".");
  if (!saltString || !hashString || extra.length !== 0) return false;

  try {
    const salt = Buffer.from(saltString, "base64url");
    const expected = Buffer.from(hashString, "base64url");
    if (salt.length !== 16 || expected.length !== PASSWORD_LENGTH) return false;
    const received = scryptSync(password.slice(0, 1024), salt, PASSWORD_LENGTH);
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

export function validateAccountPassword(password) {
  if (typeof password !== "string" || password.length < 14 || password.length > 1024) {
    return { error: "Choose a password between 14 and 1024 characters." };
  }
  return { password };
}

export function validateAccount(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid account details and try again." };
  }

  const fullName = typeof value.fullName === "string" ? value.fullName.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const role = value.role;
  const subsidiary = value.subsidiary;
  if (!fullName || fullName.length > 120 || fullName.length < 2) {
    return { error: "Enter a name between 2 and 120 characters." };
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { error: "Enter a valid email address." };
  }
  if (!ACCOUNT_ROLES.includes(role)) {
    return { error: "Choose a valid account role. Main administrator access cannot be assigned." };
  }
  if (!SUBSIDIARIES.includes(subsidiary)) {
    return { error: "Choose a valid group company or subsidiary." };
  }
  return { account: { fullName, email, role, subsidiary } };
}

export function validateAccountReview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Choose approve or reject." };
  }
  if (value.action !== "approve" && value.action !== "reject") {
    return { error: "Choose approve or reject." };
  }
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (value.action === "reject" && (reason.length < 5 || reason.length > 500)) {
    return { error: "Enter a rejection reason between 5 and 500 characters." };
  }
  return { review: { action: value.action, reason: value.action === "reject" ? reason : "" } };
}

export function generateTemporaryPassword() {
  return randomBytes(24).toString("base64url");
}
