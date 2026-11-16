const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMISSION_TYPES = new Set(["career", "community", "contact"]);

/**
 * @param {string} type
 * @returns {type is "career" | "community" | "contact"}
 */
function isSubmissionType(type) {
  return SUBMISSION_TYPES.has(type);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} maximumLength
 * @param {{ required?: boolean; minimumLength?: number }} [options]
 * @returns {{ error: string } | { value: string }}
 */
function text(value, field, maximumLength, { required = false, minimumLength = 0 } = {}) {
  if (typeof value !== "string") {
    return { error: `${field} must be text.` };
  }
  const normalized = value.trim();
  if (required && normalized.length < minimumLength) {
    return { error: `${field} must contain at least ${minimumLength} characters.` };
  }
  if (normalized.length > maximumLength) {
    return { error: `${field} must be ${maximumLength} characters or fewer.` };
  }
  return { value: normalized };
}

/**
 * @param {string} type
 * @param {unknown} value
 * @returns {{ error: string; submission?: never } | { error?: never; submission: {
 *   type: "career" | "community" | "contact",
 *   fullName: string,
 *   email: string,
 *   phone: string,
 *   location: string,
 *   subject: string,
 *   message: string,
 *   newsletterOptIn: boolean
 * } }}
 */
export function validatePublicSubmission(type, value) {
  if (!isSubmissionType(type) || !value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "This submission is invalid." };
  }
  const fields = /** @type {Record<string, unknown>} */ (value);

  if (fields.consent !== true) {
    return { error: "Confirm the consent statement before submitting." };
  }

  const submissionType = type;
  const fullName = text(fields.fullName, "Full name", 120, { required: true, minimumLength: 2 });
  if (fullName.error) return fullName;

  const email = text(fields.email, "Email address", 254, { required: true, minimumLength: 3 });
  if (email.error) return email;
  if (!EMAIL_PATTERN.test(email.value)) {
    return { error: "Enter a valid email address." };
  }

  const phone = text(fields.phone ?? "", "Phone number", 30);
  if (phone.error) return phone;

  const location = text(fields.location ?? "", "City or region", 100);
  if (location.error) return location;

  const subject = text(fields.subject ?? "", submissionType === "career" ? "Area of interest" : "Subject", 120, {
    required: submissionType !== "community",
    minimumLength: submissionType === "community" ? 0 : 2,
  });
  if (subject.error) return subject;

  const messageMaximum = submissionType === "community" ? 800 : 3000;
  const message = text(fields.message ?? "", "Message", messageMaximum, {
    required: submissionType === "contact",
    minimumLength: submissionType === "contact" ? 10 : 0,
  });
  if (message.error) return message;

  if (submissionType !== "community" && fields.newsletterOptIn === true) {
    return { error: "Newsletter preferences are available for community registrations only." };
  }

  return {
    submission: {
      type: submissionType,
      fullName: fullName.value,
      email: email.value,
      phone: phone.value,
      location: location.value,
      subject: subject.value,
      message: message.value,
      newsletterOptIn: fields.newsletterOptIn === true,
    },
  };
}
