const JOIN_WINDOW_MS = 15 * 60 * 1000;

export function isJoinWindowOpen(now, startsAt, endsAt) {
  return Number.isFinite(now) &&
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    now >= startsAt - JOIN_WINDOW_MS &&
    now <= endsAt;
}

export function authorizeLiveSessionJoin({ role, userId, teacherId, enrolled }) {
  if (role === "teacher") {
    return userId === teacherId
      ? { allowed: true, role: "teacher", status: 200 }
      : { allowed: false, role: null, status: 403 };
  }
  if (role === "learner") {
    return enrolled
      ? { allowed: true, role: "learner", status: 200 }
      : { allowed: false, role: null, status: 403 };
  }
  if (role === "administrator") {
    return { allowed: true, role: "administrator", status: 200 };
  }
  return { allowed: false, role: null, status: 403 };
}

export function canInitiallyPublish(role) {
  return role === "teacher" || role === "learner";
}

export function transitionLiveSessionStatus(status, action) {
  const transitions = {
    scheduled: { start: "live", cancel: "cancelled" },
    live: { end: "ended", cancel: "cancelled" },
  };
  return transitions[status]?.[action] || null;
}
