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
    return { error: "Upload a profile image to the configured image storage." };
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
  const registrationFee = value.registrationFee === undefined ? 0 : value.registrationFee;
  if (!Number.isSafeInteger(registrationFee) || registrationFee < 0) {
    return { error: "Enter a valid non-negative programme registration fee." };
  }
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
      registrationFee,
    },
  };
}

export function validateProgrammePaymentPlan(value, registrationFee = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid programme payment details." };
  }
  const totalFee = value.totalFee;
  const paymentInstructions = boundedText(value.paymentInstructions, "payment instructions", 2000);
  if (paymentInstructions.error) return { error: paymentInstructions.error };
  if (!Number.isSafeInteger(totalFee) || totalFee < 0) {
    return { error: "Enter a valid non-negative programme fee." };
  }
  if (!Number.isSafeInteger(registrationFee) || registrationFee < 0 || totalFee < registrationFee) {
    return { error: "The total programme fee cannot be less than the activation fee." };
  }
  if (!Array.isArray(value.installments) || value.installments.length > 24) {
    return { error: "Add between one and 24 payment intervals for a programme fee, or none for a free programme." };
  }
  if ((totalFee === 0 && value.installments.length !== 0) ||
      (totalFee > 0 && value.installments.length === 0)) {
    return { error: "Payment intervals must cover the full programme fee." };
  }
  const installments = [];
  let amountTotal = 0;
  let previousDueDays = -1;
  let registrationInstallmentSeen = false;
  for (const [index, item] of value.installments.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Enter valid payment interval details." };
    }
    const label = boundedText(item.label, "payment interval label", 120, 2);
    if (label.error) return { error: label.error };
    if (!Number.isSafeInteger(item.amount) || item.amount <= 0 ||
        amountTotal > Number.MAX_SAFE_INTEGER - item.amount) {
      return { error: "Enter valid payment interval amounts." };
    }
    if (!Number.isInteger(item.dueDaysAfterEnrollment) ||
        item.dueDaysAfterEnrollment < 0 || item.dueDaysAfterEnrollment > 3650 ||
        item.dueDaysAfterEnrollment < previousDueDays) {
      return { error: "Payment due days must be ordered from 0 to 3650 days after enrollment." };
    }
    const paymentCategory = item.paymentCategory === undefined
      ? "installment"
      : item.paymentCategory;
    if (!["registration", "installment"].includes(paymentCategory)) {
      return { error: "Choose registration or installment for each payment interval." };
    }
    if (paymentCategory === "registration") {
      if (registrationInstallmentSeen || index !== 0 || item.amount !== registrationFee ||
          item.dueDaysAfterEnrollment !== 0) {
        return { error: "The registration payment must be the first interval and match the registration fee." };
      }
      registrationInstallmentSeen = true;
    }
    amountTotal += item.amount;
    previousDueDays = item.dueDaysAfterEnrollment;
    installments.push({
      sequenceNumber: index + 1,
      label: label.value,
      amount: item.amount,
      dueDaysAfterEnrollment: item.dueDaysAfterEnrollment,
      paymentCategory,
    });
  }
  if (amountTotal !== totalFee) {
    return { error: "Payment intervals must add up to the total programme fee." };
  }
  if (registrationFee > 0 && !registrationInstallmentSeen) {
    return { error: "Add the registration fee as the first scheduled payment." };
  }
  return {
    paymentPlan: {
      totalFee,
      paymentInstructions: paymentInstructions.value,
      installments,
    },
  };
}

export function getNextInstallmentPayment(installments, amountPaid, totalFee) {
  if (!Array.isArray(installments) ||
      !Number.isSafeInteger(amountPaid) || amountPaid < 0 ||
      !Number.isSafeInteger(totalFee) || totalFee < 0) {
    return null;
  }
  const outstandingBalance = totalFee - amountPaid;
  if (outstandingBalance <= 0) return null;

  let remainingPaid = amountPaid;
  for (const [index, installment] of installments.entries()) {
    if (!installment || !Number.isSafeInteger(installment.amount) || installment.amount <= 0) {
      return null;
    }
    const paidTowardInstallment = Math.min(remainingPaid, installment.amount);
    remainingPaid -= paidTowardInstallment;
    const amountDue = installment.amount - paidTowardInstallment;
    if (amountDue > 0) {
      return {
        sequenceNumber: Number.isSafeInteger(installment.sequenceNumber)
          ? installment.sequenceNumber
          : index + 1,
        amount: Math.min(amountDue, outstandingBalance),
      };
    }
  }
  return null;
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
  const deliveryMode = value.deliveryMode === undefined ? "online" : value.deliveryMode;
  const meetingUrl = boundedText(
    typeof value.meetingUrl === "string" ? value.meetingUrl : "",
    "live-class meeting link",
    1000,
    deliveryMode === "online" ? 1 : 0,
  );
  const venue = boundedText(typeof value.venue === "string" ? value.venue : "", "class venue", 250);
  if (title.error || meetingUrl.error) return { error: title.error || meetingUrl.error };
  if (!["online", "location", "venue"].includes(deliveryMode)) {
    return { error: "Choose an online class, training location, or other approved venue." };
  }
  if (venue.error) return { error: venue.error };
  if (typeof value.moduleId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.moduleId)) {
    return { error: "Choose a valid course module for this class." };
  }
  if (typeof value.startsAt !== "string" || Number.isNaN(Date.parse(value.startsAt))) {
    return { error: "Choose a valid live-class start time." };
  }
  if (Date.parse(value.startsAt) < Date.now() - 5 * 60 * 1000) {
    return { error: "Choose a live-class start time that is not in the past." };
  }
  if (meetingUrl.value) {
    try {
      const url = new URL(meetingUrl.value);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    } catch {
      return { error: "Use a secure HTTPS link for the live class." };
    }
  }
  const locationId = typeof value.locationId === "string" ? value.locationId : "";
  if (deliveryMode === "location" && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(locationId)) {
    return { error: "Choose an active TGFVP training location." };
  }
  if (deliveryMode === "venue" && venue.value.length < 2) {
    return { error: "Enter the approved venue name or address." };
  }
  return {
    liveClass: {
      title: title.value,
      meetingUrl: meetingUrl.value,
      deliveryMode,
      locationId: deliveryMode === "location" ? locationId : null,
      venue: deliveryMode === "venue" ? venue.value : "",
      moduleId: value.moduleId,
      startsAt: new Date(value.startsAt).toISOString(),
    },
  };
}

export function validateTeacherProfile(value, cloudName, teacherId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Enter valid teacher profile details." };
  }
  const title = boundedText(value.title, "professional title", 120);
  const biography = boundedText(value.biography, "profile biography", 2000);
  const qualifications = boundedText(value.qualifications, "qualifications", 1200);
  if (title.error || biography.error || qualifications.error) {
    return { error: title.error || biography.error || qualifications.error };
  }
  if (value.photoUrl !== undefined && typeof value.photoUrl !== "string") {
    return { error: "Enter a valid profile photo URL." };
  }
  const photoUrl = typeof value.photoUrl === "string" ? value.photoUrl.trim() : "";
  if (photoUrl && !validTeacherProfilePhotoUrl(photoUrl, cloudName, teacherId)) {
    return { error: "Choose a profile photo uploaded to your account's image storage." };
  }
  return {
    profile: {
      title: title.value,
      biography: biography.value,
      qualifications: qualifications.value,
      ...(value.photoUrl === undefined ? {} : { photoUrl }),
    },
  };
}

function validTeacherProfilePhotoUrl(value, cloudName, teacherId) {
  if (typeof value !== "string" || value.length > 1000 || !cloudName || !teacherId) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${cloudName}/image/upload/`) &&
      url.pathname.includes(`/tgfvp/teacher-profiles/${teacherId}/`);
  } catch {
    return false;
  }
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
