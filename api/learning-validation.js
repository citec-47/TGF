const boardGroups = [
  "Board of Directors",
  "Executive Leadership",
  "Directors",
  "Subsidiary Management",
  "Supervisory Functions",
  "Operational Team",
];

function boundedText(value, label, maximum, minimum = 0) {
  if (typeof value !== "string") return { error: `Enter a valid ${label}.` };
  const text = value.trim();
  if (text.length < minimum || text.length > maximum) {
    return {
      error: `Enter a ${label} between ${minimum} and ${maximum} characters.`,
    };
  }
  return { value: text };
}

function validImageUrl(value, cloudName) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 1000 || !cloudName) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${cloudName}/image/upload/`) &&
      url.pathname.includes("/tgfvp/")
    );
  } catch {
    return false;
  }
}

export function getBoardGroups() {
  return [...boardGroups];
}

export function validateBoardMember(value, cloudName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid board-member details." };
  }
  const fullName = boundedText(value.fullName, "full name", 120, 2);
  const positionTitle = boundedText(value.positionTitle, "position title", 120, 2);
  const hierarchyGroup = boundedText(value.hierarchyGroup, "hierarchy group", 100, 2);
  const biography = boundedText(value.biography, "biography", 1200);
  if (fullName.error || positionTitle.error || hierarchyGroup.error || biography.error) {
    return { error: fullName.error || positionTitle.error || hierarchyGroup.error || biography.error };
  }
  if (!boardGroups.includes(hierarchyGroup.value)) {
    return { error: "Choose a board hierarchy group." };
  }
  if (!Number.isInteger(value.sortOrder) || value.sortOrder < 0 || value.sortOrder > 9999) {
    return { error: "Choose a display order between 0 and 9999." };
  }
  const photoUrl = typeof value.photoUrl === "string" ? value.photoUrl : "";
  if (!validImageUrl(photoUrl, cloudName)) {
    return { error: "Upload a profile image to the configured TGF Cloudinary account." };
  }
  if (typeof value.isActive !== "boolean") {
    return { error: "Choose whether this profile is visible to the public." };
  }
  return {
    member: {
      fullName: fullName.value,
      positionTitle: positionTitle.value,
      hierarchyGroup: hierarchyGroup.value,
      biography: biography.value,
      photoUrl,
      sortOrder: value.sortOrder,
      isActive: value.isActive,
    },
  };
}

export function validateProgramme(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid programme details." };
  }
  const title = boundedText(value.title, "programme title", 120, 2);
  const description = boundedText(value.description, "programme description", 2000);
  if (title.error || description.error) return { error: title.error || description.error };
  if (!Number.isInteger(value.sortOrder) || value.sortOrder < 0 || value.sortOrder > 9999) {
    return { error: "Choose a programme display order between 0 and 9999." };
  }
  if (typeof value.isActive !== "boolean") {
    return { error: "Choose whether this programme is open for enrollment." };
  }
  return {
    programme: {
      title: title.value,
      description: description.value,
      sortOrder: value.sortOrder,
      isActive: value.isActive,
    },
  };
}

export function validateModule(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid module details." };
  }
  const title = boundedText(value.title, "module title", 160, 2);
  const description = boundedText(value.description, "module description", 1000);
  const lessonContent = boundedText(value.lessonContent, "lesson content", 30000);
  const meetingUrl = boundedText(value.meetingUrl, "live-class meeting link", 1000);
  if (title.error || description.error || lessonContent.error || meetingUrl.error) {
    return { error: title.error || description.error || lessonContent.error || meetingUrl.error };
  }
  if (!Number.isInteger(value.position) || value.position < 1 || value.position > 9999) {
    return { error: "Choose a module position between 1 and 9999." };
  }
  if (typeof value.isReleased !== "boolean") {
    return { error: "Choose whether this module should be released to learners." };
  }
  if (meetingUrl.value) {
    try {
      const url = new URL(meetingUrl.value);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    } catch {
      return { error: "Use a secure HTTPS link for the live class." };
    }
  }
  return {
    module: {
      title: title.value,
      description: description.value,
      lessonContent: lessonContent.value,
      meetingUrl: meetingUrl.value,
      position: value.position,
      isReleased: value.isReleased,
    },
  };
}

export function validateLiveClass(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid live-class details." };
  }
  const title = boundedText(value.title, "live-class title", 160, 2);
  const meetingUrl = boundedText(value.meetingUrl, "live-class meeting link", 1000, 1);
  if (title.error || meetingUrl.error) return { error: title.error || meetingUrl.error };
  if (typeof value.moduleId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.moduleId)) {
    return { error: "Choose a valid course module for this class." };
  }
  if (typeof value.startsAt !== "string" || Number.isNaN(Date.parse(value.startsAt))) {
    return { error: "Choose a valid live-class start time." };
  }
  if (Date.parse(value.startsAt) < Date.now() - 5 * 60 * 1000) {
    return { error: "Choose a live-class start time that is not in the past." };
  }
  try {
    const url = new URL(meetingUrl.value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch {
    return { error: "Use a secure HTTPS link for the live class." };
  }
  return {
    liveClass: {
      title: title.value,
      meetingUrl: meetingUrl.value,
      moduleId: value.moduleId,
      startsAt: new Date(value.startsAt).toISOString(),
    },
  };
}

export function validateWhiteboardStrokes(value) {
  if (!Array.isArray(value) || value.length > 350) {
    return { error: "The whiteboard can hold up to 350 strokes at a time." };
  }
  const strokes = [];
  for (const stroke of value) {
    if (
      !stroke ||
      typeof stroke !== "object" ||
      typeof stroke.color !== "string" ||
      !/^#[\da-f]{6}$/i.test(stroke.color) ||
      typeof stroke.width !== "number" ||
      !Number.isFinite(stroke.width) ||
      stroke.width < 1 ||
      stroke.width > 12 ||
      !Array.isArray(stroke.points) ||
      stroke.points.length < 1 ||
      stroke.points.length > 1000
    ) {
      return { error: "The whiteboard drawing data is invalid." };
    }
    const points = [];
    for (const point of stroke.points) {
      if (
        !point ||
        typeof point.x !== "number" ||
        !Number.isFinite(point.x) ||
        point.x < 0 ||
        point.x > 1 ||
        typeof point.y !== "number" ||
        !Number.isFinite(point.y) ||
        point.y < 0 ||
        point.y > 1
      ) {
        return { error: "The whiteboard drawing coordinates are invalid." };
      }
      points.push({ x: point.x, y: point.y });
    }
    strokes.push({ color: stroke.color.toUpperCase(), width: stroke.width, points });
  }
  return { strokes };
}
