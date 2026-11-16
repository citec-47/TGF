const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateWeeklyTimetable(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !Array.isArray(value.slots) || value.slots.length < 1 || value.slots.length > 25) {
    return { error: "Add between one and 25 weekly time slots." };
  }

  const timezone = typeof value.timezone === "string" ? value.timezone.trim() : "Africa/Douala";
  if (timezone.length > 80) return { error: "Choose a valid timetable time zone." };
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "Choose a valid timetable time zone." };
  }

  const slots = [];
  for (const slot of value.slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot) ||
        !Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7 ||
        typeof slot.startsAt !== "string" || !TIME_PATTERN.test(slot.startsAt) ||
        typeof slot.endsAt !== "string" || !TIME_PATTERN.test(slot.endsAt) ||
        slot.startsAt >= slot.endsAt) {
      return { error: "Each slot must have a weekday and a valid start and end time." };
    }
    slots.push({
      weekday: slot.weekday,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
  }

  slots.sort((left, right) =>
    left.weekday - right.weekday || left.startsAt.localeCompare(right.startsAt));
  for (let index = 1; index < slots.length; index += 1) {
    const previous = slots[index - 1];
    const current = slots[index];
    if (previous.weekday === current.weekday && current.startsAt < previous.endsAt) {
      return { error: "Time slots on the same day cannot overlap." };
    }
  }

  return { timetable: { timezone, slots } };
}

export function canonicalConversationUsers(firstUserId, secondUserId) {
  if (typeof firstUserId !== "string" || typeof secondUserId !== "string" ||
      firstUserId === secondUserId) return null;
  return firstUserId < secondUserId
    ? [firstUserId, secondUserId]
    : [secondUserId, firstUserId];
}

export function validateDashboardTheme(value) {
  if (value !== "light" && value !== "dark") {
    return { error: "Choose light or dark mode." };
  }
  return { theme: value };
}
