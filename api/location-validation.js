import { createHash } from "node:crypto";

function isCloudinaryImageUrl(value, cloudName) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      Boolean(cloudName) &&
      url.pathname.startsWith(`/${cloudName}/image/upload/`)
    );
  } catch {
    return false;
  }
}

export function validateLocation(value, cloudName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid location details and try again." };
  }

  const fieldLimits = {
    city: 100,
    region: 100,
    address: 300,
    description: 500,
  };
  const fields = {};

  for (const [field, maximum] of Object.entries(fieldLimits)) {
    const input = value[field];
    if (typeof input !== "string") {
      return { error: "Complete each location field before saving." };
    }
    fields[field] = input.trim();
    if (fields[field].length > maximum || (field === "city" && !fields.city)) {
      return { error: "Check the required city name and field lengths." };
    }
  }

  if (typeof value.isActive !== "boolean") {
    return { error: "Choose whether this location is visible on the public website." };
  }
  if (!Number.isInteger(value.sortOrder) || value.sortOrder < 0 || value.sortOrder > 9999) {
    return { error: "Display order must be a whole number between 0 and 9999." };
  }

  const imageUrl = value.imageUrl === "" ? "" : value.imageUrl;
  if (
    typeof imageUrl !== "string" ||
    imageUrl.length > 1000 ||
    (imageUrl !== "" && !isCloudinaryImageUrl(imageUrl, cloudName))
  ) {
    return { error: "Choose a photo uploaded to the configured Cloudinary account." };
  }

  return {
    location: {
      ...fields,
      isActive: value.isActive,
      sortOrder: value.sortOrder,
      imageUrl,
    },
  };
}

export function createCloudinarySignature({ folder, timestamp, uploadPreset, apiSecret }) {
  if (
    typeof folder !== "string" ||
    !Number.isInteger(timestamp) ||
    typeof uploadPreset !== "string" ||
    typeof apiSecret !== "string"
  ) {
    throw new TypeError("Cloudinary signing parameters are invalid.");
  }

  const parameters = {
    folder,
    timestamp: String(timestamp),
    upload_preset: uploadPreset,
  };
  const signatureBase = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join("&");
  return createHash("sha1").update(`${signatureBase}${apiSecret}`).digest("hex");
}
