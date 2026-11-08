export const SITE_SETTING_DEFAULTS = Object.freeze({
  resumptionDate: "",
  resumptionLabel: "Training resumes",
  accentColor: "#F47D20",
  flyerImageUrl: "/TWO/WhatsApp%20Image%202026-10-29%20at%2021.12.52.jpeg",
});

export function isValidAccentColor(value) {
  if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) return false;
  const hex = value.slice(1);
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const luminance = channels
    .map((channel) => {
      const linear = channel / 255;
      return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

  return luminance <= 0.42;
}

export function validateSiteSettings(value, cloudName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid website settings and try again." };
  }

  const { resumptionDate, resumptionLabel, accentColor, flyerImageUrl } = value;
  if (
    typeof resumptionDate !== "string" ||
    (resumptionDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(resumptionDate))
  ) {
    return { error: "Choose a valid training resumption date." };
  }
  if (resumptionDate) {
    const parsedDate = new Date(`${resumptionDate}T00:00:00Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== resumptionDate
    ) {
      return { error: "Choose a valid training resumption date." };
    }
  }
  if (
    typeof resumptionLabel !== "string" ||
    !resumptionLabel.trim() ||
    resumptionLabel.trim().length > 100
  ) {
    return { error: "Enter a display label of at most 100 characters." };
  }
  if (!isValidAccentColor(accentColor)) {
    return { error: "Choose a dark enough six-digit hex colour to keep text readable." };
  }

  let validCloudinaryImage = false;
  if (typeof flyerImageUrl === "string" && flyerImageUrl.startsWith("/TWO/")) {
    validCloudinaryImage = [
      "/TWO/WhatsApp%20Image%202026-10-29%20at%2021.12.52.jpeg",
      "/TWO/WhatsApp%20Image%202026-11-08%20at%2003.58.35.jpeg",
    ].includes(flyerImageUrl);
  } else if (typeof flyerImageUrl === "string" && flyerImageUrl.length <= 1000 && cloudName) {
    try {
      const url = new URL(flyerImageUrl);
      validCloudinaryImage =
        url.protocol === "https:" &&
        url.hostname === "res.cloudinary.com" &&
        new RegExp(
          `^/${cloudName}/image/upload/(?:[^/]+/)*tgfvp/flyers/[\\w.-]+$`,
        ).test(url.pathname);
    } catch {
      validCloudinaryImage = false;
    }
  }
  if (!validCloudinaryImage) {
    return { error: "Upload the flyer to the configured TGF Cloudinary account first." };
  }

  return {
    settings: {
      resumptionDate,
      resumptionLabel: resumptionLabel.trim(),
      accentColor: accentColor.toUpperCase(),
      flyerImageUrl,
    },
  };
}
