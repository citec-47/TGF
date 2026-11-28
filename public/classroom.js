const studentLoginPanel = document.querySelector("#student-login-panel");
const studentDashboard = document.querySelector("#student-dashboard");
const studentLessonPanel = document.querySelector("#student-lesson-panel");
const studentCourseList = document.querySelector("#student-course-list");
const studentPathwayList = document.querySelector("#student-pathway-list");
const studentDashboardViews = [...document.querySelectorAll("#student-dashboard .student-dashboard-view")];
const studentFeeList = document.querySelector("#student-fees-list");
const studentEnrollmentPanel = document.querySelector("#student-enrollment-panel");
const studentEnrollmentList = document.querySelector("#student-enrollment-list");
const studentEnrollmentMessage = document.querySelector("#student-enrollment-message");
const studentPaymentProof = document.querySelector("#student-payment-proof");
const studentPendingPanel = document.querySelector("#student-pending-panel");
const studentPendingProgrammes = document.querySelector("#student-pending-programmes");
const studentPendingMessage = document.querySelector("#student-pending-message");
const studentLiveClassList = document.querySelector("#student-live-class-list");
const studentAccountStatusMessage = document.querySelector("#student-account-status-message");
const teacherLoginPanel = document.querySelector("#teacher-login-panel");
const teacherDashboard = document.querySelector("#teacher-dashboard");
const teacherRoom = document.querySelector("#teacher-room");
const teacherLiveRoom = document.querySelector("#teacher-live-room");
const teacherProfileForm = document.querySelector("#teacher-profile-form");
const teacherClassForm = document.querySelector("#teacher-class-form");
const classroomSignOut = document.querySelector("#classroom-sign-out");
const isStudentPage = Boolean(studentDashboard);
const isTeacherPage = Boolean(teacherDashboard);
const studentNavigationLinks = [...document.querySelectorAll("#student-dashboard .student-sidebar nav a")];
const teacherNavigationLinks = [...document.querySelectorAll("#teacher-dashboard .student-sidebar nav a")];
try {
  const dashboardTheme = window.localStorage.getItem("tgf-dashboard-theme");
  if (dashboardTheme === "dark" || dashboardTheme === "light") {
    document.querySelector(".classroom-page")?.classList.toggle("is-dark", dashboardTheme === "dark");
    document.body.classList.toggle("is-dark", dashboardTheme === "dark");
    document.documentElement.style.colorScheme = dashboardTheme;
  }
} catch {
  // Server preference is loaded after the account session is available.
}

function applyDirectDashboardTheme(theme) {
  if (!["light", "dark"].includes(theme)) return;
  const page = document.querySelector(".classroom-page");
  const toggle = document.querySelector("#dashboard-theme-toggle");
  if (!page || !toggle) return;
  const isDark = theme === "dark";
  page.classList.toggle("is-dark", isDark);
  document.body.classList.toggle("is-dark", isDark);
  document.documentElement.style.colorScheme = theme;
  toggle.hidden = false;
  toggle.disabled = false;
  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  toggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  try {
    window.localStorage.setItem("tgf-dashboard-theme", theme);
  } catch {
    // The server preference remains available as the fallback.
  }
}

async function loadDirectDashboardTheme() {
  const toggle = document.querySelector("#dashboard-theme-toggle");
  if (!toggle) return;
  toggle.hidden = false;
  try {
    const saved = await requestJson("/api/collaboration/preferences");
    applyDirectDashboardTheme(saved.theme || "light");
  } catch {
    const saved = window.localStorage.getItem("tgf-dashboard-theme");
    applyDirectDashboardTheme(saved === "dark" ? "dark" : "light");
  }
}

function initializeDirectDashboardTheme() {
  const toggle = document.querySelector("#dashboard-theme-toggle");
  if (!toggle || toggle.dataset.directInitialized === "true") return;
  toggle.dataset.directInitialized = "true";
  toggle.hidden = false;
  let saved = "light";
  try {
    saved = window.localStorage.getItem("tgf-dashboard-theme") || "light";
  } catch {
    saved = "light";
  }
  applyDirectDashboardTheme(saved === "dark" ? "dark" : "light");
  toggle.addEventListener("click", async () => {
    const page = document.querySelector(".classroom-page");
    if (!page) return;
    const current = page.classList.contains("is-dark") ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    toggle.disabled = true;
    applyDirectDashboardTheme(next);
    try {
      const result = await requestJson("/api/collaboration/preferences", {
        method: "PUT",
        body: JSON.stringify({ theme: next }),
      });
      applyDirectDashboardTheme(result.theme || next);
    } catch {
      const status = document.querySelector("[data-user-theme-status]");
      if (status) {
        status.textContent = "Theme applied on this browser, but could not sync with your account.";
        status.classList.add("is-error");
      }
    } finally {
      toggle.disabled = false;
    }
  });
  void loadDirectDashboardTheme();
}

initializeDirectDashboardTheme();
let activeStudentLiveClassId;
let studentPresenceTimer;
let studentPaymentStatusSnapshot = "";
let studentPaymentRefreshInProgress = false;
let teacherLocations = [];
let teacherAccountRole = "";
let teacherProfilePhotoFile = null;
let teacherProfilePhotoPreviewUrl = "";
let activeStudentModule = null;
let studentLessonProgressRefreshInProgress = false;
let teacherDailyAnswerRefreshInProgress = false;

function syncStudentNavigation() {
  const hash = window.location.hash;
  const activeHref = studentNavigationLinks.some((link) => link.hash === hash)
    ? hash
    : "#student-overview";

  for (const link of studentNavigationLinks) {
    const active = link.hash === activeHref;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  for (const view of studentDashboardViews) {
    const active = view.id === activeHref.slice(1);
    view.hidden = !active;
    if (active && !studentDashboard.hidden) {
      window.requestAnimationFrame(() => view.scrollIntoView({ block: "start" }));
    }
  }
}

if (studentNavigationLinks.length) {
  syncStudentNavigation();
  window.addEventListener("hashchange", syncStudentNavigation);
}

function syncTeacherNavigation() {
  const hash = window.location.hash;
  const hashTarget = hash ? document.getElementById(hash.slice(1)) : null;
  const parentView = hashTarget?.closest("[data-teacher-dashboard-view]");
  const viewId = parentView?.dataset.teacherDashboardView;
  const activeHref = teacherNavigationLinks.some((link) => link.hash === hash)
    ? hash
    : teacherNavigationLinks.some((link) => link.hash === `#${viewId}`)
      ? `#${viewId}`
      : "#teacher-overview";
  const activeViewId = activeHref.slice(1);

  for (const link of teacherNavigationLinks) {
    const active = link.hash === activeHref;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  for (const view of teacherDashboard.querySelectorAll("[data-teacher-dashboard-view]")) {
    const active = view.dataset.teacherDashboardView === activeViewId;
    view.hidden = !active;
    if (active && !teacherDashboard.hidden && hash) {
      window.requestAnimationFrame(() => view.scrollIntoView({ block: "start" }));
    }
  }
}

if (teacherNavigationLinks.length) {
  syncTeacherNavigation();
  window.addEventListener("hashchange", syncTeacherNavigation);
}

const paths = isStudentPage
  ? {
      session: "/api/dashboard/session",
      login: "/api/auth/login",
      loginPanel: studentLoginPanel,
      loginForm: document.querySelector("#student-login-form"),
      loginMessage: document.querySelector("#student-login-message"),
      dashboard: studentDashboard,
    }
  : isTeacherPage
    ? {
        session: "/api/dashboard/session",
        login: "/api/auth/login",
        loginPanel: teacherLoginPanel,
        loginForm: document.querySelector("#teacher-login-form"),
        loginMessage: document.querySelector("#teacher-login-message"),
        dashboard: teacherDashboard,
      }
    : null;

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
  if (!response.ok) throw new Error(value.error || "The request could not be completed.");
  return value;
}

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function formatXaf(amount) {
  return `XAF ${new Intl.NumberFormat("en-CM").format(amount)}`;
}

function parsePageRange(text) {
  const match = String(text || "").match(/\bpages?\s+(\d+)(?:\s*(?:-|–|to)\s*(\d+))?/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  return Number.isInteger(start) && Number.isInteger(end) && end >= start
    ? { start, end }
    : null;
}

function pageRangeForWeek(week) {
  const materialRanges = (week?.materials || [])
    .filter((material) => Number.isInteger(material.pageStart) && Number.isInteger(material.pageEnd))
    .map((material) => ({ start: material.pageStart, end: material.pageEnd }));
  if (materialRanges.length) {
    return {
      start: Math.min(...materialRanges.map((range) => range.start)),
      end: Math.max(...materialRanges.map((range) => range.end)),
    };
  }
  const lessonRanges = [...String(week?.lessonContent || "").matchAll(/^Day [1-5] \| ([^\n]+)/gm)]
    .map((marker) => parsePageRange(marker[1]))
    .filter(Boolean);
  return lessonRanges.length
    ? {
        start: Math.min(...lessonRanges.map((range) => range.start)),
        end: Math.max(...lessonRanges.map((range) => range.end)),
      }
    : null;
}

function pageRangeForModule(module) {
  const ranges = (module?.weeks || []).map(pageRangeForWeek).filter(Boolean);
  return ranges.length
    ? {
        start: Math.min(...ranges.map((range) => range.start)),
        end: Math.max(...ranges.map((range) => range.end)),
      }
    : null;
}

function pageRangeLabel(range) {
  if (!range) return "";
  return range.start === range.end
    ? `page ${range.start}`
    : `pages ${range.start}-${range.end}`;
}

function hasSourceExtractionWarning(module) {
  return [module?.description, ...(module?.weeks || []).map((week) => week.description)]
    .some((description) => /automatic text extraction could not read this source/i.test(description || ""));
}

function formatModuleTitle(module) {
  let title = String(module?.title || "")
    .replace(/^(?:Module\s+\d+\s*:\s*)+/i, "")
    .trim();
  const pageRange = pageRangeForModule(module);
  if (pageRange && /^(?:page\s+\d+|source segment\s+\d+|source section|assigned source section)$/i.test(title)) {
    title = `Source ${pageRangeLabel(pageRange)}`;
  }
  return title || (pageRange ? `Source ${pageRangeLabel(pageRange)}` : "Course materials");
}

function formatModuleSummary(module) {
  const weeks = module?.weeks || [];
  const hasDailyPlan = weeks.length > 0 &&
    weeks.every((week) => parseWeekDayMarkers(week.lessonContent).length === 5);
  const planSummary = weeks.length
    ? `${weeks.length} weeks${hasDailyPlan ? ` · ${weeks.length * 5} study days` : ""}`
    : "";
  const pageRange = pageRangeForModule(module);
  const pageSummary = pageRange ? `Source ${pageRangeLabel(pageRange)}` : "";
  if (hasSourceExtractionWarning(module)) {
    return [
      planSummary,
      pageSummary,
      "Open the assigned pages in the original document; daily prompts are study guidance, not extracted lesson text.",
    ].filter(Boolean).join(" · ");
  }
  return module?.description || [planSummary, pageSummary].filter(Boolean).join(" · ") || "Course outline";
}

function stripSourceExtractionWarning(description) {
  return String(description || "")
    .replace(/Automatic text extraction could not read this source\.[\s\S]*$/i, "")
    .trim();
}

function formatWeekTitle(week) {
  const weekNumber = Number(week?.weekNumber) || 0;
  let topic = String(week?.title || "").replace(/^Week\s+\d+\s*:\s*/i, "").trim();
  const pageRange = pageRangeForWeek(week);
  if (pageRange && /^(?:page\s+\d+|source segment\s+\d+|source section|assigned source section)$/i.test(topic)) {
    topic = `Source ${pageRangeLabel(pageRange)}`;
  }
  return `Week ${weekNumber}${topic ? `: ${topic}` : ""}`;
}

function getStudentPaymentStatusSnapshot(programmes) {
  return JSON.stringify(programmes.map((programme) => [
    programme.id,
    programme.enrollmentId || "",
    programme.paymentStatus || "",
    Number(programme.amountPaid) || 0,
    Number(programme.amountPending) || 0,
    Number(programme.outstandingBalance) || 0,
    programme.paymentRejectionReason || "",
  ]));
}

function showMessage(element, message, error = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", error);
}

function createButton(text, callback, className = "button button-dark") {
  const button = node("button", className, text);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function showClassroomLogin(message = "", error = false) {
  const messageCenter = document.querySelector('[data-message-center="user"]');
  if (messageCenter) messageCenter.hidden = true;
  window.dispatchEvent(new Event("tgf-account-signed-out"));
  paths.loginPanel.hidden = false;
  paths.dashboard.hidden = true;
  if (isStudentPage) {
    studentAccountStatusMessage.hidden = true;
    studentLoginPanel.querySelector(".admin-intro").textContent =
      "Sign in to continue your course, or create your student account to enroll.";
    document.querySelector("#student-login-form").hidden = false;
    document.querySelector("#student-register-form").hidden = false;
  }
  if (studentEnrollmentPanel) studentEnrollmentPanel.hidden = true;
  if (studentPendingPanel) studentPendingPanel.hidden = true;
  if (studentLessonPanel) studentLessonPanel.hidden = true;
  if (teacherRoom) teacherRoom.hidden = true;
  if (teacherLiveRoom) teacherLiveRoom.hidden = true;
  classroomSignOut.hidden = true;
  if (message) showMessage(paths.loginMessage, message, error);
}

async function loadStudentCourses(programmesSnapshot) {
  const shouldReturnToDashboard = studentDashboard.hidden;
  studentDashboard.hidden = true;
  studentPendingPanel.hidden = true;
  studentEnrollmentPanel.hidden = false;
  showMessage(studentEnrollmentMessage, "Checking your enrollment status…");
  studentCourseList.replaceChildren();
  studentPathwayList.replaceChildren();
  studentFeeList.replaceChildren();
  studentEnrollmentList.replaceChildren();
  studentLiveClassList.replaceChildren();
  try {
    const programmes = programmesSnapshot || await requestJson("/api/student/courses");
    studentPaymentStatusSnapshot = getStudentPaymentStatusSnapshot(programmes);
    const approvedProgrammes = programmes.filter((programme) => programme.enrollmentStatus === "approved");
    const pendingProgrammes = programmes.filter((programme) => programme.enrollmentStatus === "pending");
    renderStudentLearningProgress(approvedProgrammes);

    if (!approvedProgrammes.length) {
      if (pendingProgrammes.length) {
        studentEnrollmentPanel.hidden = true;
        studentPendingPanel.hidden = false;
        studentPendingProgrammes.replaceChildren(
          ...pendingProgrammes.map((programme) => {
            const card = node("article", "course-card");
            card.append(
              node("p", "micro-label", "Awaiting administrator confirmation"),
              node("h2", "", programme.title),
              node(
                "p",
                "admin-intro",
                programme.paymentStatus === "not_required"
                  ? "No registration fee is due. Your enrollment is awaiting administrator approval."
                  : programme.paymentStatus === "approved"
                  ? "Payment verified. Your enrollment is awaiting administrator approval."
                  : programme.paymentStatus === "pending"
                    ? "Your payment evidence is being reviewed."
                    : "Upload payment evidence to continue your enrollment request.",
              ),
            );
            if (programme.paymentStatus === "not_required") {
              card.append(node("span", "enrollment-badge", "Enrollment pending"));
            } else if (programme.paymentStatus === "approved") {
              card.append(node("span", "enrollment-badge is-open", "Payment verified · Enrollment pending"));
            } else if (programme.paymentStatus === "pending") {
              card.append(node("span", "enrollment-badge", "Payment review pending"));
            } else {
              if (programme.paymentRejectionReason) {
                card.append(node("p", "admin-message is-error", `Payment not accepted: ${programme.paymentRejectionReason}`));
              }
              card.append(
                createButton(
                  "Upload payment evidence",
                  () => void requestStudentEnrollment(programme),
                  "button button-orange",
                ),
              );
            }
            return card;
          }),
        );
        showMessage(studentPendingMessage, "Your learning dashboard will become available as soon as your enrollment is approved.");
        return;
      }

      studentPendingPanel.hidden = true;
      studentEnrollmentPanel.hidden = false;
      if (!programmes.length) {
        studentEnrollmentList.append(
          node("p", "admin-empty", "There are no programmes open for enrollment yet. Please check back soon."),
        );
      }
      for (const programme of programmes) {
        const card = node("article", "course-card");
        card.append(
          node("p", "micro-label", "TGFVP programme"),
          node("h2", "", programme.title),
          node("p", "admin-intro", programme.description || "Contact TGFVP for programme details."),
          node(
            "p",
            "admin-location-subtitle",
            Number(programme.registrationFee) > 0
              ? `Registration fee: XAF ${new Intl.NumberFormat("en-CM").format(programme.registrationFee)}`
              : "No registration fee",
          ),
        );
        if (programme.enrollmentStatus === "rejected" && programme.rejectionReason) {
          card.append(node("p", "admin-message is-error", `Previous request: ${programme.rejectionReason}`));
        }
        card.append(
          createButton(
            Number(programme.registrationFee) > 0 ? "Upload proof and request enrollment" : "Request enrollment",
            () => void requestStudentEnrollment(programme),
            "button button-orange",
          ),
        );
        studentEnrollmentList.append(card);
      }
      showMessage(studentEnrollmentMessage, "");
      return;
    }

    studentEnrollmentPanel.hidden = true;
    studentPendingPanel.hidden = true;
    studentDashboard.hidden = false;
    if (shouldReturnToDashboard) window.scrollTo(0, 0);
    syncStudentNavigation();
    const allModules = approvedProgrammes.flatMap((programme) => programme.modules);
    const liveClasses = approvedProgrammes.flatMap((programme) => programme.liveClasses || []);
    document.querySelector("#student-active-count").textContent = String(approvedProgrammes.length);
    document.querySelector("#student-completed-count").textContent = String(allModules.filter((module) => module.completed).length);
    const liveCount = document.querySelector("#student-live-count");
    liveCount.dataset.courseLiveCount = String(liveClasses.length);
    liveCount.textContent = String(
      liveClasses.length +
      Number(liveCount.dataset.timetableLiveCount || 0) +
      Number(liveCount.dataset.invitationLiveCount || 0),
    );

    for (const programme of approvedProgrammes) {
      const card = node("article", "student-pathway-card");
      const details = node("div", "student-pathway-copy");
      const completedModules = programme.modules.filter((module) => module.completed).length;
      details.append(
        node("p", "micro-label", "Enrolled programme"),
        node("h3", "", programme.title),
        node("p", "", programme.description || "Continue your studies in this programme."),
      );
      card.append(
        details,
        node(
          "span",
          "student-pathway-progress",
          programme.modules.length
            ? `${completedModules} of ${programme.modules.length} modules complete`
            : "Your instructor is preparing the first module.",
        ),
        createButton(
          "View course",
          () => {
            window.location.hash = "#student-my-course";
          },
          "button button-quiet",
        ),
      );
      studentPathwayList.append(card);
    }

    const enrolledProgrammes = programmes.filter((programme) => programme.enrollmentStatus !== "not_enrolled");
    for (const programme of enrolledProgrammes) {
      const card = node("details", "course-card student-course-details");
      const header = node("summary", "student-course-summary");
      const heading = node("div", "admin-panel-heading");
      const description = node("div");
      description.append(
        node("p", "micro-label", programme.enrollmentStatus === "approved" ? "Your enrolled course" : "TGFVP programme"),
        node("h2", "", programme.title),
        node("p", "admin-intro", programme.description || "Contact TGFVP for programme details."),
      );
      const badge = node(
        "span",
        programme.enrollmentStatus === "approved" ? "enrollment-badge is-open" : "enrollment-badge",
        programme.enrollmentStatus === "approved"
          ? "Enrolled"
          : programme.enrollmentStatus === "pending"
            ? "Awaiting approval"
            : programme.isActive
              ? "Enrollment open"
              : "Enrollment closed",
      );
      heading.append(description, badge);
      header.append(heading);
      card.append(header);

      if (programme.enrollmentStatus === "pending") {
        card.append(node("span", "enrollment-badge", "Pending approval"));
      } else if (programme.enrollmentStatus !== "approved") {
        const actions = node("div", "course-actions");
        actions.append(node(
          "p",
          "admin-location-subtitle",
          Number(programme.registrationFee) > 0
            ? `Registration fee: XAF ${new Intl.NumberFormat("en-CM").format(programme.registrationFee)}`
            : "No registration fee",
        ));
        actions.append(
          createButton(
            Number(programme.registrationFee) > 0 ? "Upload proof and request enrollment" : "Request enrollment",
            () => void requestStudentEnrollment(programme),
            "button button-orange",
          ),
        );
        card.append(actions);
      } else {
        const paymentInfo = node("article", "student-fee-card");
        const feeHeading = node("div", "student-fee-heading");
        const feeTitle = node("div");
        feeTitle.append(
          node("p", "micro-label", "Payment plan"),
          node("h3", "", programme.title),
        );
        const feeStatus = programme.amountPending > 0
          ? "Awaiting review"
          : programme.outstandingBalance <= 0
            ? "Paid in full"
            : programme.paymentStatus === "rejected"
              ? "Receipt declined"
              : "Payment due";
        const feeStatusClass = programme.amountPending > 0
          ? "student-fee-status is-pending"
          : programme.outstandingBalance <= 0
            ? "student-fee-status is-paid"
            : programme.paymentStatus === "rejected"
              ? "student-fee-status is-rejected"
              : "student-fee-status";
        feeHeading.append(feeTitle, node("span", feeStatusClass, feeStatus));
        paymentInfo.append(feeHeading);
        const paymentMetrics = node("div", "student-fee-metrics");
        for (const [label, amount] of [
          ["Total fee", programme.totalFee],
          ["Paid", programme.amountPaid],
          ["Awaiting approval", programme.amountPending],
          ["Balance due", programme.outstandingBalance],
        ]) {
          const metric = node("div", "student-fee-metric");
          metric.append(
            node("span", "", label),
            node("strong", "", formatXaf(amount)),
          );
          paymentMetrics.append(metric);
        }
        paymentInfo.append(paymentMetrics);
        if (programme.totalFee > 0) {
          const progress = document.createElement("progress");
          progress.className = "student-fee-progress";
          progress.max = programme.totalFee;
          progress.value = Math.min(programme.amountPaid, programme.totalFee);
          progress.setAttribute(
            "aria-label",
            `${formatXaf(programme.amountPaid)} paid of ${formatXaf(programme.totalFee)}`,
          );
          paymentInfo.append(progress);
        }
        if (programme.amountPending > 0) {
          paymentInfo.append(node(
            "p",
            "student-fee-notice is-pending",
            `Payment evidence sent · Waiting for administrator approval. ${formatXaf(programme.amountPending)} will be deducted from your balance after approval.`,
          ));
        } else if (programme.paymentStatus === "rejected" && programme.paymentRejectionReason) {
          paymentInfo.append(node(
            "p",
            "student-fee-notice is-rejected",
            `Your receipt was declined: ${programme.paymentRejectionReason}. Please upload a new receipt for this payment.`,
          ));
        }
        const instructions = node("div", "student-fee-instructions");
        instructions.append(
          node("span", "", "How to pay"),
          node(
            "p",
            "",
            programme.paymentInstructions ||
              "Payment instructions have not been added yet. Contact the administrator before paying.",
          ),
        );
        paymentInfo.append(instructions);
        const installments = Array.isArray(programme.installments)
          ? [...programme.installments].sort((left, right) => left.sequenceNumber - right.sequenceNumber)
          : [];
        const pendingReview = Number(programme.amountPending) > 0;
        let paidToAllocate = Math.max(Number(programme.amountPaid) || 0, 0);
        const paymentOptions = installments.map((installment, index) => {
          const installmentAmount = Number(installment.amount);
          const paidTowardInstallment = Math.min(paidToAllocate, installmentAmount);
          paidToAllocate -= paidTowardInstallment;
          return {
            ...installment,
            sequenceNumber: Number(installment.sequenceNumber) || index + 1,
            amountDue: Math.max(installmentAmount - paidTowardInstallment, 0),
          };
        });
        const nextInstallment = paymentOptions.find((installment) => installment.amountDue > 0);
        if (paymentOptions.length) {
          const scheduleSection = node("div", "student-fee-schedule");
          const scheduleHeading = node("div", "student-fee-schedule-heading");
          scheduleHeading.append(
            node("h4", "", "Your payment schedule"),
            node("p", "", "Registration is included in the total course fee."),
          );
          scheduleSection.append(scheduleHeading);
          for (const installment of paymentOptions) {
            const dueDate = installment.dueAt
              ? new Intl.DateTimeFormat("en-CM", { dateStyle: "medium" }).format(new Date(installment.dueAt))
              : "Date to be confirmed";
            const status = installment.amountDue === 0
              ? "Paid"
              : pendingReview && installment.sequenceNumber === nextInstallment?.sequenceNumber
                ? "Awaiting review"
                : installment.sequenceNumber === nextInstallment?.sequenceNumber
                  ? `Next · ${formatXaf(installment.amountDue)}`
                  : "Due after previous payment";
            const row = node("div", "student-fee-installment");
            const installmentName = node("div", "student-fee-installment-name");
            installmentName.append(
              node("strong", "", installment.label),
              node("span", "", `Due ${dueDate}`),
            );
            row.append(
              installmentName,
              node("strong", "student-fee-installment-amount", formatXaf(installment.amount)),
              node(
                "span",
                `student-fee-installment-status${installment.amountDue === 0 ? " is-paid" : ""}`,
                status,
              ),
            );
            scheduleSection.append(row);
          }
          paymentInfo.append(scheduleSection);
        }
        if (programme.outstandingBalance > 0) {
          if (installments.length) {
            const installmentLabel = document.createElement("label");
            installmentLabel.className = "student-payment-label";
            installmentLabel.textContent = "Select the payment you are making";
            const installmentSelect = document.createElement("select");
            installmentSelect.setAttribute("aria-label", `Installment to pay for ${programme.title}`);
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Choose an installment";
            placeholder.selected = true;
            placeholder.disabled = true;
            installmentSelect.append(placeholder);

            for (const [index, installment] of paymentOptions.entries()) {
              const option = document.createElement("option");
              option.value = String(installment.sequenceNumber);
              const title = installment.label ||
                (installment.paymentCategory === "registration"
                  ? "Registration fee"
                  : `Installment ${index + 1}`);
              const dueDate = installment.dueAt
                ? new Intl.DateTimeFormat("en-CM", { dateStyle: "medium" }).format(new Date(installment.dueAt))
                : "Date to be confirmed";
              const status = installment.amountDue === 0
                ? "Paid"
                : pendingReview
                  ? "Awaiting verification"
                  : installment.sequenceNumber === nextInstallment?.sequenceNumber
                    ? "Next payment"
                    : "Available after the previous installment";
              const amountToShow = installment.amountDue || installment.amount;
              option.textContent =
                `${title} · ${formatXaf(amountToShow)} · due ${dueDate} · ${status}`;
              option.dataset.label = title;
              option.disabled = pendingReview ||
                installment.amountDue === 0 ||
                installment.sequenceNumber !== nextInstallment?.sequenceNumber;
              option.dataset.amount = String(installment.amountDue);
              installmentSelect.append(option);
            }
            if (nextInstallment) {
              installmentSelect.value = String(nextInstallment.sequenceNumber);
            }
            installmentLabel.append(installmentSelect);

            const paymentHint = node(
              "p",
              "admin-field-hint",
              pendingReview
                ? "Your submitted payment is being reviewed. You can choose the next scheduled payment after verification."
                : "The next unpaid payment is selected automatically. Attach its payment evidence, then submit.",
            );
            const evidenceLabel = document.createElement("label");
            evidenceLabel.className = "student-payment-label";
            evidenceLabel.textContent = "Payment evidence (PDF, image or Word document; max 10 MB)";
            const evidenceInput = document.createElement("input");
            evidenceInput.type = "file";
            evidenceInput.name = "paymentProof";
            evidenceInput.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
            evidenceInput.setAttribute("aria-label", `Payment evidence for ${programme.title}`);
            evidenceInput.disabled = pendingReview || !nextInstallment;
            evidenceLabel.append(evidenceInput);
            const clearPaymentError = () => {
              const message = document.querySelector("#student-course-message");
              if (message.classList.contains("is-error")) showMessage(message, "");
            };
            installmentSelect.addEventListener("change", clearPaymentError);
            evidenceInput.addEventListener("change", clearPaymentError);

            const paymentForm = document.createElement("form");
            paymentForm.className = "student-payment-submission-form";
            const paymentButton = node(
              "button",
              "button button-orange",
              pendingReview ? "Waiting for approval" : "Submit payment evidence",
            );
            paymentButton.type = "submit";
            installmentSelect.disabled = pendingReview || !nextInstallment;
            paymentButton.disabled = pendingReview || !nextInstallment;
            paymentForm.addEventListener("submit", (event) => {
              event.preventDefault();
              void submitStudentInstallmentPayment(
                programme,
                installmentSelect,
                evidenceInput,
                paymentButton,
              );
            });
            paymentForm.append(installmentLabel, evidenceLabel, paymentHint, paymentButton);
            paymentInfo.append(paymentForm);
          } else {
            paymentInfo.append(node(
              "p",
              "admin-message is-error",
              "No payment schedule is available. Contact the administrator before making a payment.",
            ));
          }
        }

        if (Number(programme.totalFee) > 0) studentFeeList.append(paymentInfo);
        if (programme.courseCompleted) {
          card.append(node(
            "p",
            "admin-message",
            "Congratulations! You have completed this programme. Please be patient while TGFVP prepares the official certificate ceremony.",
          ));
        }
        const list = node("div", "course-module-list");
        if (!programme.modules.length) {
          list.append(
            node(
              "p",
              "admin-empty",
              "Your instructor is preparing the first module. It will appear here when the administrator releases it.",
            ),
          );
        }
        for (const module of programme.modules) {
          const item = node(
            "article",
            `course-module-card${module.completed ? " is-complete" : ""}${module.isUnlocked ? "" : " is-locked"}`,
          );
          const moduleTitle = node("div", "course-module-title");
          moduleTitle.append(node("span", "module-position-badge", String(module.position)));
          const moduleDetails = node("div");
          moduleDetails.append(
            node("h3", "", formatModuleTitle(module)),
            node(
              "p",
              "",
              module.completed
                ? "Completed"
                : module.isUnlocked
                  ? formatModuleSummary(module)
                  : module.isReleased
                    ? "Complete the previous module to unlock this lesson."
                    : "Waiting for your administrator to release this module.",
            ),
          );
          moduleTitle.append(moduleDetails);
          item.append(moduleTitle);
          if (module.completed) {
            item.append(node("span", "enrollment-badge is-open", "Complete"));
          } else if (module.isUnlocked) {
            item.append(
              createButton("Open module", () => void openStudentLesson(module), "button button-orange"),
            );
          } else {
            item.append(node("span", "enrollment-badge", "Locked"));
          }
          list.append(item);
        }
        card.append(list);
      }
      studentCourseList.append(card);
    }

    const availableProgrammes = programmes.filter((programme) => programme.enrollmentStatus === "not_enrolled");
    if (availableProgrammes.length) {
      const browse = node("details", "student-course-browse");
      const browseHeading = node("summary", "student-course-browse-heading");
      browseHeading.append(
        node("strong", "", "Browse other programmes"),
        node("span", "", "Not enrolled yet"),
      );
      const browseList = node("div", "student-course-browse-list");
      for (const programme of availableProgrammes) {
        const option = node("article", "student-course-option");
        option.append(
          node("h3", "", programme.title),
          node("p", "", programme.description || "Contact TGFVP for programme details."),
          node(
            "p",
            "admin-location-subtitle",
            Number(programme.registrationFee) > 0
              ? `Registration fee: ${formatXaf(programme.registrationFee)}`
              : "No registration fee",
          ),
          createButton(
            Number(programme.registrationFee) > 0 ? "Upload proof and request enrollment" : "Request enrollment",
            () => void requestStudentEnrollment(programme),
            "button button-orange",
          ),
        );
        browseList.append(option);
      }
      browse.append(browseHeading, browseList);
      studentCourseList.append(browse);
    }

    if (!studentFeeList.childElementCount) {
      studentFeeList.append(node("p", "admin-empty", "There are no programme fees to pay at this time."));
    }

    if (!liveClasses.length) {
      studentLiveClassList.append(node("p", "admin-empty", "No upcoming live classes are scheduled."));
    }
    for (const liveClass of liveClasses) {
      const classCard = node("article", "live-class-card");
      const details = node("div");
      const when = new Intl.DateTimeFormat("en-CM", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(liveClass.startsAt));
      details.append(
        node("h3", "", liveClass.title),
        node("p", "", `${liveClass.programmeTitle} · ${liveClass.moduleTitle} · ${when}`),
        node("p", "admin-location-subtitle", liveClass.deliveryMode === "location"
          ? `Training location · ${liveClass.locationName || "Contact TGFVP for details"}`
          : liveClass.deliveryMode === "venue"
            ? `Venue · ${liveClass.venue}`
            : "Online class"),
      );
      if (liveClass.teacherProfile) {
        const profile = liveClass.teacherProfile;
        if (profile.photoUrl) {
          const photo = node("img", "teacher-profile-photo-preview");
          photo.src = profile.photoUrl;
          photo.alt = `${profile.name}'s profile photo`;
          details.append(photo);
        }
        details.append(
          node("p", "micro-label", `Tutor · ${profile.name}${profile.title ? ` · ${profile.title}` : ""}`),
        );
        if (profile.biography) details.append(node("p", "admin-location-subtitle", profile.biography));
        if (profile.qualifications) {
          details.append(node("p", "admin-location-subtitle", profile.qualifications));
        }
      }
      classCard.append(details);
      if (liveClass.deliveryMode === "online") {
        classCard.append(
          createButton("Join class", () => void joinStudentClass(liveClass), "button button-orange"),
        );
      }
      studentLiveClassList.append(classCard);
    }
    showMessage(document.querySelector("#student-course-message"), "");
  } catch (error) {
    showMessage(studentEnrollmentMessage, error.message, true);
    showStudentLearningProgressError(error);
  }
}

function renderStudentLearningProgress(programmes) {
  const container = document.querySelector("[data-student-learning-progress]");
  if (!container) return;
  container.replaceChildren();

  const heading = node("div", "student-learning-progress-heading");
  heading.append(
    node("h3", "", "Course performance rate"),
    node(
      "p",
      "",
      "Each week is scored out of 100% from teacher-approved daily answers. Module performance is the average across its four weeks.",
    ),
  );
  container.append(heading);

  if (!programmes.length) {
    container.append(node("p", "admin-empty", "Your course performance will appear here after your enrollment is approved."));
    return;
  }

  const programmeList = node("div", "student-learning-progress-programmes");
  const moduleScores = [];
  for (const programme of programmes) {
    const programmeCard = node("section", "student-learning-progress-programme");
    programmeCard.append(node("h4", "", programme.title));

    const modules = Array.isArray(programme.modules) ? programme.modules : [];
    if (!modules.length) {
      programmeCard.append(node("p", "admin-empty", "Your instructor is preparing the first module."));
      programmeList.append(programmeCard);
      continue;
    }

    const moduleList = node("div", "student-learning-progress-modules");
    for (const module of modules) {
      const weeks = Array.isArray(module.weeks) ? module.weeks : [];
      const weekProgress = Array.from({ length: 4 }, (_, index) => {
        const weekNumber = index + 1;
        const week = weeks.find((item) => Number(item.weekNumber) === weekNumber);
        const approvedDays = Math.min(5, Math.max(0, Number(week?.completedDays) || 0));
        const percentage = module.completed ? 100 : approvedDays * 20;
        return {
          weekNumber,
          approvedDays,
          hasDailyPlan: Number(week?.totalDays) > 0,
          percentage,
          isLocked: module.isUnlocked === false || week?.isAccessible === false,
        };
      });
      const modulePercentage = Math.round(
        weekProgress.reduce((total, week) => total + week.percentage, 0) / 4,
      );
      moduleScores.push(modulePercentage);

      const moduleCard = node("article", "student-learning-progress-module");
      const moduleHeading = node("div", "student-learning-progress-module-heading");
      moduleHeading.append(
        node("h5", "", `Module ${module.position}: ${module.title}`),
        node("strong", "", `${modulePercentage}%`),
      );
      const moduleBar = document.createElement("progress");
      moduleBar.className = "student-learning-progress-module-bar";
      moduleBar.max = 100;
      moduleBar.value = modulePercentage;
      moduleBar.setAttribute("aria-label", `Module ${module.position} progress across four weeks`);
      moduleCard.append(moduleHeading, moduleBar);

      const weekGrid = node("div", "student-learning-progress-weeks");
      for (const week of weekProgress) {
        const weekCard = node("div", "student-learning-progress-week");
        const weekHeading = node("div", "student-learning-progress-week-heading");
        weekHeading.append(
          node("span", "", `Week ${week.weekNumber}`),
          node("strong", "", `${week.percentage}%`),
        );
        const weekBar = document.createElement("progress");
        weekBar.max = 100;
        weekBar.value = week.percentage;
        weekBar.setAttribute("aria-label", `Week ${week.weekNumber} progress`);
        weekCard.append(
          weekHeading,
          weekBar,
          node(
            "small",
            "",
            week.isLocked
              ? "Locked until earlier work is approved"
              : week.hasDailyPlan
                ? `${week.approvedDays} of 5 daily answers approved`
                : "No daily plan available",
          ),
        );
        weekGrid.append(weekCard);
      }
      moduleCard.append(weekGrid);
      moduleList.append(moduleCard);
    }

    programmeCard.append(moduleList);
    programmeList.append(programmeCard);
  }

  if (moduleScores.length) {
    const overallPercentage = Math.round(
      moduleScores.reduce((total, percentage) => total + percentage, 0) / moduleScores.length,
    );
    const overallCard = node("div", "student-learning-progress-overall");
    const overallHeading = node("div", "student-learning-progress-module-heading");
    overallHeading.append(
      node("strong", "", "Overall performance"),
      node("strong", "", `${overallPercentage}%`),
    );
    const overallBar = document.createElement("progress");
    overallBar.max = 100;
    overallBar.value = overallPercentage;
    overallBar.setAttribute("aria-label", `Overall course performance ${overallPercentage}%`);
    overallCard.append(overallHeading, overallBar);
    container.append(overallCard);
  }
  container.append(programmeList);
}

function showStudentLearningProgressError(error) {
  const container = document.querySelector("[data-student-learning-progress]");
  if (!container) return;
  const heading = node("div", "student-learning-progress-heading");
  heading.append(
    node("h3", "", "Course performance rate"),
    node("p", "", "Each week is scored out of 100% from teacher-approved daily answers."),
  );
  container.replaceChildren(
    heading,
    node("p", "admin-message is-error", `Course performance could not be loaded: ${error.message}`),
  );
}

async function refreshStudentLearningProgress() {
  const refreshButton = document.querySelector("[data-student-progress-refresh]");
  if (refreshButton) refreshButton.disabled = true;
  try {
    const programmes = await requestJson("/api/student/courses");
    renderStudentLearningProgress(
      programmes.filter((programme) => programme.enrollmentStatus === "approved"),
    );
  } catch (error) {
    showStudentLearningProgressError(error);
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

async function refreshStudentPaymentStatus() {
  if (!isStudentPage || document.visibilityState !== "visible" ||
      (studentDashboard.hidden && studentPendingPanel.hidden) ||
      studentPaymentRefreshInProgress ||
      studentCourseList.querySelector('.student-payment-submission-form input[type="file"]')?.files?.length) {
    return;
  }
  studentPaymentRefreshInProgress = true;
  try {
    const programmes = await requestJson("/api/student/courses");
    if (getStudentPaymentStatusSnapshot(programmes) !== studentPaymentStatusSnapshot) {
      await loadStudentCourses(programmes);
    }
  } catch (error) {
    const message = studentPendingPanel.hidden
      ? document.querySelector("#student-course-message")
      : studentPendingMessage;
    showMessage(message,
      `Payment status could not be refreshed: ${error.message}`, true);
  } finally {
    studentPaymentRefreshInProgress = false;
  }
}

async function requestStudentEnrollment(programme) {
  if (Number(programme.registrationFee) === 0) {
    const message = !studentPendingPanel.hidden
      ? studentPendingMessage
      : studentDashboard.hidden
        ? studentEnrollmentMessage
        : document.querySelector("#student-course-message");
    const form = new FormData();
    form.set("programmeId", programme.id);
    showMessage(message, `Requesting enrollment in ${programme.title}…`);
    try {
      await requestJson("/api/student/enrollments", { method: "POST", body: form });
      await loadStudentCourses();
    } catch (error) {
      showMessage(message, error.message, true);
    }
    return;
  }
  studentPaymentProof.value = "";
  studentPaymentProof.dataset.paymentMode = "activation";
  studentPaymentProof.dataset.programmeId = programme.id;
  studentPaymentProof.click();
}

async function submitStudentInstallmentPayment(
  programme,
  installmentSelect,
  evidenceInput,
  submitButton,
) {
  const selectedOption = installmentSelect.selectedOptions[0];
  const amount = Number(selectedOption?.dataset.amount);
  const sequenceNumber = Number(installmentSelect.value);
  const file = evidenceInput.files?.[0];
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > programme.outstandingBalance) {
    const message = document.querySelector("#student-course-message");
    showMessage(message, "Choose the next unpaid payment before submitting payment evidence.", true);
    installmentSelect.focus();
    return;
  }
  if (!file) {
    showMessage(document.querySelector("#student-course-message"), "Choose a payment evidence file to submit.", true);
    evidenceInput.focus();
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showMessage(document.querySelector("#student-course-message"), "Files must be smaller than 10 MB.", true);
    evidenceInput.focus();
    return;
  }

  const form = new FormData();
  form.set("enrollmentId", programme.enrollmentId);
  form.set("amount", String(amount));
  form.set("sequenceNumber", String(sequenceNumber));
  form.set("paymentProof", file);
  submitButton.disabled = true;
  installmentSelect.disabled = true;
  evidenceInput.disabled = true;
  const originalButtonText = submitButton.textContent;
  submitButton.textContent = "Submitting receipt…";
  const message = document.querySelector("#student-course-message");
  showMessage(message, `Submitting ${formatXaf(amount)} for ${selectedOption.dataset.label || "the selected payment"}…`);
  try {
    await requestJson("/api/student/payments", { method: "POST", body: form });
  } catch (error) {
    showMessage(message, error.message, true);
    submitButton.disabled = false;
    installmentSelect.disabled = false;
    evidenceInput.disabled = false;
    submitButton.textContent = originalButtonText;
    return;
  }
  evidenceInput.value = "";
  submitButton.textContent = "Waiting for approval";
  showMessage(message, "Receipt submitted. It will update your balance after the administrator approves it.");
  void refreshStudentPaymentStatus();
}

async function submitStudentPaymentProof() {
  const file = studentPaymentProof.files?.[0];
  const programmeId = studentPaymentProof.dataset.programmeId;
  const paymentMode = studentPaymentProof.dataset.paymentMode || "activation";
  if (!file || (paymentMode === "installment"
    ? !studentPaymentProof.dataset.enrollmentId
    : !programmeId)) return;
  const message = !studentPendingPanel.hidden
    ? studentPendingMessage
    : studentDashboard.hidden
      ? studentEnrollmentMessage
      : document.querySelector("#student-course-message");
  if (file.size > 10 * 1024 * 1024) {
    showMessage(message, "Files must be smaller than 10 MB.", true);
    return;
  }
  const form = new FormData();
  if (paymentMode === "installment") {
    form.set("enrollmentId", studentPaymentProof.dataset.enrollmentId || "");
    form.set("amount", studentPaymentProof.dataset.amount || "");
    form.set("sequenceNumber", studentPaymentProof.dataset.installmentSequence || "");
  } else {
    form.set("programmeId", programmeId);
  }
  form.set("paymentProof", file);
  showMessage(message, "Submitting payment evidence…");
  try {
    await requestJson(paymentMode === "installment" ? "/api/student/payments" : "/api/student/enrollments", {
      method: "POST",
      body: form,
    });
    await loadStudentCourses();
  } catch (error) {
    showMessage(message, error.message, true);
  }
}

function parseWeekDayMarkers(lessonContent) {
  const markers = [...String(lessonContent || "").matchAll(/^Day ([1-5]) \| ([^\n]+)\r?\n/gm)];
  return markers.length === 5 &&
      markers.every((marker, index) => Number(marker[1]) === index + 1) &&
      markers[0].index === 0
    ? markers
    : [];
}

function renderStudentDailyAnswerForm(moduleId, weekNumber, dayNumber, answer) {
  const panel = node("section", "daily-answer-panel");
  const heading = node("div", "daily-answer-heading");
  heading.append(
    node("h5", "", "Daily questions and activities"),
    node(
      "span",
      `daily-answer-status${answer?.reviewStatus ? ` is-${answer.reviewStatus.replaceAll("_", "-")}` : ""}`,
      answer?.reviewStatus === "approved"
        ? "Approved"
        : answer?.reviewStatus === "submitted"
          ? "Awaiting review"
          : answer?.reviewStatus === "changes_requested"
            ? "Changes requested"
            : "Not submitted",
    ),
  );
  panel.append(heading);
  const responseText = typeof answer?.responseText === "string" ? answer.responseText : "";
  const teacherFeedback = typeof answer?.teacherFeedback === "string" ? answer.teacherFeedback : "";
  if (answer?.reviewStatus) {
    const reviewMessage = node(
      "p",
      `daily-answer-review-message is-${answer.reviewStatus.replaceAll("_", "-")}`,
      answer.reviewStatus === "submitted"
        ? "Submitted. Your teacher will review this answer."
        : answer.reviewStatus === "approved"
          ? "Your teacher approved this answer."
          : "Your teacher requested changes. Revise your response and resubmit it.",
    );
    panel.append(reviewMessage);
    if (responseText) panel.append(node("p", "daily-answer-response", responseText));
    if (teacherFeedback) {
      panel.append(node("p", "admin-location-subtitle", `Teacher feedback: ${teacherFeedback}`));
    }
    if (answer.reviewStatus !== "changes_requested") return panel;
  }

  const form = node("form", "admin-form daily-answer-form");
  form.dataset.moduleId = moduleId;
  form.dataset.weekNumber = String(weekNumber);
  form.dataset.dayNumber = String(dayNumber);
  const label = node("label", "", "Write your answer or describe the completed activity");
  const textarea = document.createElement("textarea");
  textarea.name = "responseText";
  textarea.maxLength = 12000;
  textarea.minLength = 10;
  textarea.rows = 4;
  textarea.required = true;
  textarea.value = answer?.reviewStatus === "changes_requested" ? responseText : "";
  label.append(textarea);
  const button = node(
    "button",
    "small-action",
    answer?.reviewStatus === "changes_requested" ? "Resubmit daily answer" : "Submit daily answer",
  );
  button.type = "submit";
  form.append(label, button);
  panel.append(form);
  return panel;
}

function updateSourcePageCarousel(carousel) {
  const startPage = Number(carousel.dataset.startPage);
  const endPage = Number(carousel.dataset.endPage);
  const pageNumber = Number(carousel.dataset.currentPage);
  const pageIndex = pageNumber - startPage;
  const pageCount = endPage - startPage + 1;
  const canvas = carousel.querySelector(".source-page-canvas");
  const indicator = carousel.querySelector(".source-page-indicator");
  const previous = carousel.querySelector('[data-source-page-step="-1"]');
  const next = carousel.querySelector('[data-source-page-step="1"]');
  if (!canvas || !indicator || !previous || !next) return;

  indicator.textContent = `Source page ${pageNumber} · ${pageIndex + 1} of ${pageCount}`;
  previous.disabled = pageIndex <= 0;
  next.disabled = pageIndex >= pageCount - 1;
  canvas.dataset.pageNumber = String(pageNumber);
  canvas.width = 0;
  canvas.height = 0;
  if (carousel.dataset.deferRender === "true") {
    canvas.dataset.renderPending = "true";
    return;
  }
  requestSourcePageRender(canvas);
}

function requestSourcePageRender(canvas) {
  const renderPage = window.tgfRenderPdfPage;
  if (typeof renderPage !== "function") {
    canvas.dataset.renderPending = "true";
    return;
  }
  delete canvas.dataset.renderPending;
  const pageNumber = Number(canvas.dataset.pageNumber);
  const message = canvas.parentElement?.querySelector(".source-page-preview-message");
  if (message) {
    message.hidden = false;
    message.classList.remove("is-error");
    message.textContent = "Loading assigned page…";
  }
  void renderPage(canvas, canvas.dataset.fileUrl, pageNumber).then(() => {
    if (canvas.dataset.pageNumber === String(pageNumber) && message) message.hidden = true;
  }).catch(() => {
    if (canvas.dataset.pageNumber !== String(pageNumber) || !message) return;
    message.hidden = false;
    message.textContent = "Page preview unavailable. Open the assigned page in a new tab.";
    message.classList.add("is-error");
  });
}

function renderSourcePageCarousel(material, pageRange, deferRender = false) {
  const carousel = node("section", "source-page-carousel");
  carousel.setAttribute("aria-label", "Assigned source pages");
  carousel.dataset.fileUrl = material.fileUrl;
  carousel.dataset.startPage = String(pageRange.start);
  carousel.dataset.endPage = String(pageRange.end);
  carousel.dataset.currentPage = String(pageRange.start);
  carousel.dataset.deferRender = String(deferRender);

  const header = node("div", "source-page-carousel-header");
  header.append(
    node("span", "source-page-carousel-label", "Assigned reading"),
    node("span", "source-page-indicator"),
  );
  const viewport = node("div", "source-page-viewport");
  const canvas = document.createElement("canvas");
  canvas.className = "source-page-canvas";
  canvas.dataset.fileUrl = material.fileUrl;
  canvas.dataset.pageNumber = String(pageRange.start);
  canvas.setAttribute("role", "img");
  viewport.append(canvas, node("p", "source-page-preview-message", "Loading assigned page…"));

  const controls = node("div", "source-page-carousel-controls");
  const previous = node("button", "small-action source-page-control", "Previous page");
  previous.type = "button";
  previous.dataset.sourcePageStep = "-1";
  previous.setAttribute("aria-label", "Show previous assigned page");
  const next = node("button", "small-action source-page-control", "Next page");
  next.type = "button";
  next.dataset.sourcePageStep = "1";
  next.setAttribute("aria-label", "Show next assigned page");
  controls.append(previous, next);
  carousel.append(header, viewport, controls);
  updateSourcePageCarousel(carousel);
  return carousel;
}

function assignedPageHref(fileUrl, markdownUrl, pageNumber) {
  for (const candidate of [fileUrl, markdownUrl]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate, window.location.origin);
      if (url.origin !== window.location.origin || !/^\/api\/private-files\/[^/]+$/.test(url.pathname)) {
        continue;
      }
      url.hash = `page=${pageNumber}`;
      return url.href;
    } catch {
      continue;
    }
  }
  return "";
}

function appendLessonContent(container, content, fileUrl = "") {
  const markdownLink = /\[([^\]]+)\]\(([^)]+)\)/g;
  let textStart = 0;
  let match;
  while ((match = markdownLink.exec(content))) {
    const assignedPage = match[1].match(/^Open assigned pages?\s+(\d+)/i);
    if (!assignedPage) continue;

    container.append(document.createTextNode(content.slice(textStart, match.index)));
    const href = assignedPageHref(fileUrl, match[2], Number(assignedPage[1]));
    if (href) {
      const link = node("a", "assigned-page-inline-link", match[1]);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      container.append(link);
    } else {
      container.append(document.createTextNode(match[1]));
    }
    textStart = markdownLink.lastIndex;
  }
  container.append(document.createTextNode(content.slice(textStart)));
}

function lessonTextNode(tag, className, content, fileUrl = "") {
  const element = node(tag, className);
  appendLessonContent(element, String(content || ""), fileUrl);
  return element;
}

function handleSourcePageCarouselNavigation(event) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-source-page-step]");
  const carousel = button?.closest(".source-page-carousel");
  if (!button || !carousel) return;
  const nextPage = Number(carousel.dataset.currentPage) + Number(button.dataset.sourcePageStep);
  const startPage = Number(carousel.dataset.startPage);
  const endPage = Number(carousel.dataset.endPage);
  if (nextPage < startPage || nextPage > endPage) return;
  carousel.dataset.currentPage = String(nextPage);
  updateSourcePageCarousel(carousel);
}

function handleModuleDayDialogClick(event) {
  if (!(event.target instanceof Element)) return;
  const openButton = event.target.closest("[data-open-module-day]");
  if (openButton) {
    const dialog = openButton.closest(".module-week-day")?.querySelector(".module-day-dialog");
    if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
    dialog.showModal();
    for (const carousel of dialog.querySelectorAll(".source-page-carousel")) {
      carousel.dataset.deferRender = "false";
    }
    for (const canvas of dialog.querySelectorAll(".source-page-canvas[data-render-pending]")) {
      requestSourcePageRender(canvas);
    }
    return;
  }

  const closeButton = event.target.closest("[data-close-module-day]");
  const dialog = closeButton?.closest(".module-day-dialog");
  if (dialog instanceof HTMLDialogElement) dialog.close();
}

document.addEventListener("click", handleSourcePageCarouselNavigation);
document.addEventListener("click", handleModuleDayDialogClick);
document.addEventListener("tgf-pdf-renderer-ready", () => {
  for (const canvas of document.querySelectorAll(".source-page-canvas[data-render-pending]")) {
    const dialog = canvas.closest(".module-day-dialog");
    if (!dialog || dialog.open) requestSourcePageRender(canvas);
  }
});

function renderWeekLessonContent(lessonContent, week, moduleId = "") {
  const markers = parseWeekDayMarkers(lessonContent);
  if (!markers.length) {
    const lesson = node("div", "module-week-lesson");
    const lessonText = node("div", "module-week-lesson-text");
    appendLessonContent(lessonText, lessonContent, week?.materials?.[0]?.fileUrl);
    lesson.append(lessonText);
    for (const material of week?.materials || []) {
      if (
        /\.pdf$/i.test(material.originalFilename || "") &&
        Number.isInteger(material.pageStart) &&
        Number.isInteger(material.pageEnd) &&
        material.fileUrl
      ) {
        lesson.append(renderSourcePageCarousel(material, {
          start: material.pageStart,
          end: material.pageEnd,
        }));
      }
    }
    return lesson;
  }

  const days = node("div", "module-week-days");
  const materials = week?.materials || [];
  for (const [index, marker] of markers.entries()) {
    const nextMarker = markers[index + 1];
    const contentStart = marker.index + marker[0].length;
    const contentEnd = nextMarker ? nextMarker.index : lessonContent.length;
    const pageRange = parsePageRange(marker[2]);
    const material = materials.find((candidate) =>
      !pageRange ||
      !Number.isInteger(candidate.pageStart) ||
      !Number.isInteger(candidate.pageEnd) ||
      (candidate.pageStart <= pageRange.start && candidate.pageEnd >= pageRange.end)) ||
      materials[0];
    const assignedPageRange = pageRange || (
      Number.isInteger(material?.pageStart) && Number.isInteger(material?.pageEnd)
        ? { start: material.pageStart, end: material.pageEnd }
        : null
    );
    const day = node("section", "module-week-day");
    const dayAnswer = isStudentPage
      ? (week.dailyAnswers || []).find((submission) => submission?.dayNumber === Number(marker[1]))
      : null;
    day.dataset.reviewStatus = dayAnswer?.reviewStatus || "not_submitted";
    const dayHeading = node("div", "module-week-day-heading");
    const title = node("h4");
    const openButton = node("button", "module-day-open");
    openButton.type = "button";
    openButton.dataset.openModuleDay = "true";
    openButton.setAttribute("aria-haspopup", "dialog");
    openButton.append(
      node("span", "module-day-open-title", `Day ${marker[1]}`),
      node("span", "module-day-open-hint", "Open lesson"),
    );
    title.append(openButton);
    dayHeading.append(
      title,
      node("span", "module-week-day-subtitle", marker[2]),
    );
    if (isStudentPage) {
      dayHeading.append(node(
        "span",
        `module-day-status${dayAnswer?.reviewStatus ? ` is-${dayAnswer.reviewStatus.replaceAll("_", "-")}` : ""}`,
        dayAnswer?.reviewStatus === "approved"
          ? "Approved"
          : dayAnswer?.reviewStatus === "submitted"
            ? "Awaiting review"
            : dayAnswer?.reviewStatus === "changes_requested"
              ? "Changes requested"
              : "In progress",
      ));
    }
    const dayContent = lessonContent.slice(contentStart, contentEnd).trim()
      .replace(/Open the approved document/gi, "Open the original document")
      .replace(
        /The platform could not extract its text, so verify this day against the original before teaching\./gi,
        "Text extraction was unavailable, so use the assigned pages as today's lesson content.",
      );
    const preview = node("p", "module-week-day-preview");
    appendLessonContent(preview, dayContent, material?.fileUrl);
    day.append(dayHeading, preview);
    const dialog = document.createElement("dialog");
    dialog.className = "module-day-dialog";
    dialog.dataset.deferRender = "true";
    dialog.setAttribute("aria-label", `Day ${marker[1]} lesson`);
    const dialogPanel = node("div", "module-day-dialog-panel");
    const dialogHeader = node("div", "module-day-dialog-header");
    const dialogTitle = node("h3", "", `Day ${marker[1]}`);
    const closeIcon = node("button", "module-day-dialog-x", "X");
    closeIcon.type = "button";
    closeIcon.dataset.closeModuleDay = "true";
    closeIcon.setAttribute("aria-label", `Close Day ${marker[1]} lesson`);
    dialogHeader.append(dialogTitle, closeIcon);
    const lessonText = node("div", "module-week-day-content");
    appendLessonContent(lessonText, dayContent, material?.fileUrl);
    dialogPanel.append(
      dialogHeader,
      node("p", "module-week-day-subtitle", marker[2]),
      lessonText,
    );
    if (material?.fileUrl) {
      const isPdf = /\.pdf$/i.test(material.originalFilename || "");
      if (isPdf && assignedPageRange) {
        dialogPanel.append(renderSourcePageCarousel(material, assignedPageRange, true));
      }
      const sourceLink = assignedPageRange
        ? node("button", "small-action module-day-source", `Open assigned ${pageRangeLabel(assignedPageRange)}`)
        : node("a", "small-action module-day-source", "Open original document");
      if (assignedPageRange) {
        sourceLink.type = "button";
        sourceLink.disabled = true;
      } else {
        sourceLink.href = material.fileUrl;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
      }
      dialogPanel.append(sourceLink);
    }
    if (isStudentPage && moduleId) {
      const dayNumber = Number(marker[1]);
      dialogPanel.append(renderStudentDailyAnswerForm(moduleId, week.weekNumber, dayNumber, dayAnswer));
    }
    const dialogFooter = node("div", "module-day-dialog-footer");
    const closeButton = node("button", "small-action", "Close");
    closeButton.type = "button";
    closeButton.dataset.closeModuleDay = "true";
    dialogFooter.append(closeButton);
    dialogPanel.append(dialogFooter);
    dialog.append(dialogPanel);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    day.append(dialog);
    days.append(day);
  }
  return days;
}

function captureStudentDailyAnswerDrafts() {
  const drafts = new Map();
  for (const form of document.querySelectorAll("#student-module-weeks .daily-answer-form")) {
    const key = `${form.dataset.weekNumber}:${form.dataset.dayNumber}`;
    const response = form.querySelector('textarea[name="responseText"]')?.value;
    if (response) drafts.set(key, response);
  }
  return drafts;
}

function renderStudentModuleWeeks(module, drafts = new Map()) {
  const weeks = module.weeks || [];
  const weekList = document.querySelector("#student-module-weeks");
  weekList.replaceChildren();
  weekList.hidden = weeks.length === 0;
  const studyGuidance = document.querySelector("#student-module-study-guidance");
  if (studyGuidance) {
    studyGuidance.hidden = weeks.length === 0;
    studyGuidance.textContent =
      "Each week has five daily blocks. Submit all five daily answers for teacher review to open the following week. The Week 4 capstone follows the approved daily work.";
  }

  for (const week of weeks) {
    const card = node("article", "module-week-card");
    card.append(node("p", "micro-label", `Week ${week.weekNumber}`), node("h3", "", formatWeekTitle(week)));
    if (week.isAccessible === false) {
      const releaseDate = week.availableAt ? new Date(week.availableAt) : null;
      const message = releaseDate && releaseDate.getTime() > Date.now()
        ? `Available from ${new Intl.DateTimeFormat("en-CM", { dateStyle: "medium" }).format(releaseDate)}.`
        : `Complete and receive approval for all five daily answers in Week ${week.weekNumber - 1} to open this week.`;
      card.append(node("p", "admin-message", message));
      weekList.append(card);
      continue;
    }

    if (week.totalDays > 0) {
      card.append(node(
        "p",
        "admin-location-subtitle",
        `${week.completedDays} of ${week.totalDays} daily answers approved.`,
      ));
    }
    const weekDescription = stripSourceExtractionWarning(week.description);
    if (weekDescription) {
      card.append(lessonTextNode("p", "", weekDescription, week.materials?.[0]?.fileUrl));
    }
    if (week.learningObjectives) {
      card.append(lessonTextNode(
        "p",
        "admin-location-subtitle",
        `Learning objectives: ${week.learningObjectives}`,
        week.materials?.[0]?.fileUrl,
      ));
    }
    if (week.lessonContent) {
      card.append(renderWeekLessonContent(week.lessonContent, week, module.id));
    }
    for (const material of week.materials || []) {
      const resource = node("p", "module-week-resource");
      const label = [
        material.sectionTitle,
        material.category.replaceAll("_", " "),
        material.pageStart ? `pp. ${material.pageStart}–${material.pageEnd}` : "",
      ].filter(Boolean).join(" · ");
      resource.append(node("strong", "", label));
      if (material.sectionDescription) {
        resource.append(lessonTextNode("span", "", material.sectionDescription, material.fileUrl));
      }
      if (material.learningObjectives) {
        resource.append(lessonTextNode("span", "", material.learningObjectives, material.fileUrl));
      }
      const link = node("a", "small-action", `Open ${material.title}`);
      link.href = material.fileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      resource.append(link);
      card.append(resource);
    }

    for (const form of card.querySelectorAll(".daily-answer-form")) {
      const key = `${form.dataset.weekNumber}:${form.dataset.dayNumber}`;
      const draft = drafts.get(key);
      const textarea = form.querySelector('textarea[name="responseText"]');
      if (draft && textarea && !textarea.value) textarea.value = draft;
    }
    if (module.capstoneRequired && week.weekNumber === 4) {
      if (week.totalDays === 5 && week.isComplete === true) renderStudentCapstone(module, card);
      else card.append(node(
        "p",
        "admin-message",
        "The module capstone opens after all five Week 4 daily answers are approved.",
      ));
    }
    weekList.append(card);
  }

  const completeButton = document.querySelector("#complete-module");
  completeButton.dataset.moduleId = module.id;
  completeButton.hidden = Boolean(module.capstoneRequired) ||
    (weeks.length > 0 && !weeks.every((week) => week.isComplete !== false));
}

function studentProgressSignature(module) {
  return JSON.stringify((module.weeks || []).map((week) => [
    week.weekNumber,
    week.isAccessible,
    week.isComplete,
    week.completedDays,
    (week.dailyAnswers || []).map((answer) => [
      answer?.dayNumber,
      answer?.reviewStatus,
      answer?.responseText,
      answer?.teacherFeedback,
    ]),
  ]).concat([module.capstoneSubmission?.status, module.capstoneSubmission?.feedback]));
}

async function openStudentLesson(module) {
  try {
    configureCanvas("student-board-canvas", false);
    await loadBoard(module.id, "student-board-canvas");
    document.querySelector("#student-lesson-title").textContent =
      `Module ${module.position}: ${formatModuleTitle(module)}`;
    document.querySelector("#student-lesson-description").textContent = formatModuleSummary(module);
    const moduleLessonContent = module.lessonContent || (module.weeks?.length
        ? "Follow the four weekly blocks below in order. Each week has five daily study blocks."
        : "Your teacher will add learning content for this module.");
    const lessonContent = document.querySelector("#student-lesson-content");
    lessonContent.replaceChildren();
    appendLessonContent(lessonContent, moduleLessonContent, module.weeks?.[0]?.materials?.[0]?.fileUrl);
    activeStudentModule = module;
    renderStudentModuleWeeks(module);
    showMessage(document.querySelector("#module-message"), "");
    studentDashboard.hidden = true;
    studentLessonPanel.hidden = false;
    window.requestAnimationFrame(() => drawBoard(
      document.querySelector("#student-board-canvas"),
      activeCanvasState?.strokes || [],
    ));
    startBoardRefresh(module.id, "student-board-canvas");
  } catch (error) {
    showMessage(document.querySelector("#student-course-message"), error.message, true);
  }
}

async function refreshStudentLessonProgress() {
  if (!isStudentPage || !activeStudentModule || studentLessonPanel.hidden ||
      document.visibilityState !== "visible" || studentLessonProgressRefreshInProgress) {
    return;
  }
  studentLessonProgressRefreshInProgress = true;
  try {
    const programmes = await requestJson("/api/student/courses");
    const updatedModule = programmes
      .flatMap((programme) => programme.modules || [])
      .find((module) => module.id === activeStudentModule.id);
    if (!updatedModule ||
        studentProgressSignature(updatedModule) === studentProgressSignature(activeStudentModule)) {
      return;
    }
    const newlyAccessibleWeek = (updatedModule.weeks || []).find((week) =>
      week.isAccessible && !activeStudentModule.weeks?.find((current) =>
        current.weekNumber === week.weekNumber,
      )?.isAccessible,
    );
    const drafts = captureStudentDailyAnswerDrafts();
    activeStudentModule = updatedModule;
    renderStudentModuleWeeks(updatedModule, drafts);
    if (newlyAccessibleWeek) {
      showMessage(
        document.querySelector("#module-message"),
        `Week ${newlyAccessibleWeek.weekNumber} is now open.`,
      );
    }
  } catch (error) {
    showMessage(
      document.querySelector("#module-message"),
      `Course progress could not be refreshed: ${error.message}`,
      true,
    );
  } finally {
    studentLessonProgressRefreshInProgress = false;
  }
}

async function refreshTeacherDailyAnswers() {
  if (!isTeacherPage || teacherAccountRole !== "teacher" || teacherDashboard.hidden ||
      document.visibilityState !== "visible" || teacherDailyAnswerRefreshInProgress) {
    return;
  }
  teacherDailyAnswerRefreshInProgress = true;
  try {
    const submissions = await requestJson("/api/teacher/daily-answers");
    renderTeacherDailyAnswers(submissions);
    showMessage(document.querySelector("#teacher-daily-answer-message"), "");
  } catch (error) {
    showMessage(
      document.querySelector("#teacher-daily-answer-message"),
      `Daily answers could not be refreshed: ${error.message}`,
      true,
    );
  } finally {
    teacherDailyAnswerRefreshInProgress = false;
  }
}

function renderStudentCapstone(module, parent) {
  const section = node("section", "module-capstone");
  section.append(
    node("p", "micro-label", "Module capstone"),
    node("h3", "", "Apply what you learned"),
    node("p", "", module.capstonePrompt || "Complete the capstone task for this module."),
  );
  const submission = module.capstoneSubmission;
  if (submission?.responseText) {
    section.append(node("p", "admin-location-subtitle", `Your response: ${submission.responseText}`));
  }
  if (submission?.fileUrl) {
    const link = node("a", "small-action", "View your submitted project file");
    link.href = submission.fileUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    section.append(link);
  }
  if (submission?.status === "approved") {
    section.append(node("p", "admin-message", "Your teacher approved this capstone. The next module is now available."));
  } else if (submission?.status === "submitted") {
    section.append(node("p", "admin-message", "Your capstone is with your teacher for review."));
  } else {
    if (submission?.status === "changes_requested" && submission.feedback) {
      section.append(node("p", "admin-message is-error", `Required changes: ${submission.feedback}`));
    }
    const form = node("form", "admin-form capstone-submission-form");
    form.id = "student-capstone-form";
    form.dataset.moduleId = module.id;
    const responseLabel = node("label", "", "Your written response");
    const response = document.createElement("textarea");
    response.name = "responseText";
    response.maxLength = 12000;
    response.rows = 5;
    response.value = submission?.status === "changes_requested" ? submission.responseText || "" : "";
    responseLabel.append(response);
    const fileLabel = node("label", "", "Optional project file (PDF, Word, JPG or PNG · up to 10 MB)");
    const file = document.createElement("input");
    file.type = "file";
    file.name = "file";
    file.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
    fileLabel.append(file);
    const button = node("button", "button button-orange", "Submit capstone");
    button.type = "submit";
    form.append(responseLabel, fileLabel, button);
    section.append(form);
  }
  parent.append(section);
}

async function submitStudentCapstone(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    showMessage(document.querySelector("#module-message"), "The capstone form could not be found. Refresh and try again.", true);
    return;
  }
  const file = form.elements.file.files?.[0];
  if (file && file.size > 10 * 1024 * 1024) {
    showMessage(document.querySelector("#module-message"), "Files must be smaller than 10 MB.", true);
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData();
  data.set("responseText", form.elements.responseText.value);
  if (file) data.set("file", file);
  button.disabled = true;
  showMessage(document.querySelector("#module-message"), "Submitting your capstone…");
  try {
    await requestJson(`/api/student/capstones/${encodeURIComponent(form.dataset.moduleId)}`, {
      method: "POST",
      body: data,
    });
    activeStudentModule.capstoneSubmission = { status: "submitted", responseText: data.get("responseText") || "" };
    const weeks = document.querySelector("#student-module-weeks");
    weeks.querySelector(".module-capstone")?.remove();
    renderStudentCapstone(activeStudentModule, weeks);
    showMessage(document.querySelector("#module-message"), "Your capstone was submitted for teacher review.");
  } catch (error) {
    showMessage(document.querySelector("#module-message"), error.message, true);
    button.disabled = false;
  }
}

async function submitStudentDailyAnswer(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    showMessage(document.querySelector("#module-message"), "The daily answer form could not be found. Refresh and try again.", true);
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  const weekNumber = Number(form.dataset.weekNumber);
  const dayNumber = Number(form.dataset.dayNumber);
  const responseText = form.elements.responseText.value.trim();
  button.disabled = true;
  showMessage(document.querySelector("#module-message"), "Submitting your daily answer…");
  try {
    await requestJson(`/api/student/daily-answers/${encodeURIComponent(form.dataset.moduleId)}`, {
      method: "POST",
      body: JSON.stringify({ weekNumber, dayNumber, responseText }),
    });
    const answer = {
      dayNumber,
      responseText,
      reviewStatus: "submitted",
      teacherFeedback: "",
    };
    const week = activeStudentModule?.weeks?.find((item) => item.weekNumber === weekNumber);
    if (week) {
      week.dailyAnswers = [
        ...(week.dailyAnswers || []).filter((item) => item.dayNumber !== dayNumber),
        answer,
      ];
    }
    form.closest(".daily-answer-panel")
      .replaceWith(renderStudentDailyAnswerForm(form.dataset.moduleId, weekNumber, dayNumber, answer));
    showMessage(document.querySelector("#module-message"), "Your daily answer was submitted for teacher review.");
  } catch (error) {
    showMessage(document.querySelector("#module-message"), error.message, true);
    button.disabled = false;
  }
}

async function completeStudentModule() {
  const button = document.querySelector("#complete-module");
  const moduleId = button.dataset.moduleId;
  if (!moduleId || !window.confirm("Mark this module as complete? Your completion unlocks the next released module.")) {
    return;
  }
  button.disabled = true;
  try {
    await requestJson(`/api/student/modules/${encodeURIComponent(moduleId)}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    stopBoardRefresh();
    studentLessonPanel.hidden = true;
    studentDashboard.hidden = false;
    await loadStudentCourses();
  } catch (error) {
    showMessage(document.querySelector("#module-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function joinStudentClass(liveClass) {
  try {
    stopStudentPresence();
    const result = await requestJson(`/api/live-classes/${encodeURIComponent(liveClass.id)}`);
    configureCanvas("student-live-board-canvas", false);
    await loadBoard(liveClass.moduleId, "student-live-board-canvas");
    studentDashboard.hidden = true;
    studentLessonPanel.hidden = true;
    studentLiveRoom.hidden = false;
    window.requestAnimationFrame(() => drawBoard(
      document.querySelector("#student-live-board-canvas"),
      activeCanvasState?.strokes || [],
    ));
    document.querySelector("#live-room-title").textContent = liveClass.title;
    const meeting = document.querySelector("#live-meeting-link");
    meeting.href = result.meetingUrl;
    meeting.dataset.ready = "true";
    startStudentPresence(liveClass.id);
    startBoardRefresh(liveClass.moduleId, "student-live-board-canvas");
  } catch (error) {
    showMessage(document.querySelector("#student-course-message"), error.message, true);
  }
}

function startStudentPresence(liveClassId) {
  activeStudentLiveClassId = liveClassId;
  const heartbeat = () => {
    if (!activeStudentLiveClassId) return;
    void requestJson(`/api/live-classes/${encodeURIComponent(activeStudentLiveClassId)}/presence`, {
      method: "POST",
      body: JSON.stringify({}),
    }).catch(() => {});
  };
  heartbeat();
  studentPresenceTimer = window.setInterval(heartbeat, 30000);
}

function stopStudentPresence() {
  if (studentPresenceTimer) window.clearInterval(studentPresenceTimer);
  studentPresenceTimer = undefined;
  const liveClassId = activeStudentLiveClassId;
  activeStudentLiveClassId = undefined;
  if (liveClassId) {
    void requestJson(`/api/live-classes/${encodeURIComponent(liveClassId)}/leave`, {
      method: "POST",
      body: JSON.stringify({}),
    }).catch(() => {});
  }
}

function getUpcomingTeacherClasses(classes) {
  const now = Date.now();
  return classes
    .filter((liveClass) => {
      const startsAt = Date.parse(liveClass.startsAt);
      return Number.isFinite(startsAt) && startsAt > now && liveClass.approvalStatus !== "rejected";
    })
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
}

function renderTeacherNextClass(liveClass) {
  const target = document.querySelector("#teacher-next-class");
  if (!target) return;
  target.replaceChildren();
  if (!liveClass) {
    target.append(node("p", "admin-empty", "No upcoming class is scheduled yet."));
    return;
  }

  const details = node("div");
  const when = new Intl.DateTimeFormat("en-CM", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(liveClass.startsAt));
  details.append(
    node("span", liveClass.approvalStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
      liveClass.approvalStatus === "approved" ? "Approved" : "Pending approval"),
    node("h3", "", liveClass.title),
    node("p", "", `${liveClass.programmeTitle} · ${liveClass.moduleTitle} · ${when}`),
    node("p", "admin-location-subtitle", liveClass.deliveryMode === "location"
      ? `TGFVP location · ${liveClass.locationName || "Location unavailable"}`
      : liveClass.deliveryMode === "venue"
        ? `Other venue · ${liveClass.venue}`
        : "Online class"),
  );
  const card = node("article", "live-class-card");
  card.append(details);
  if (liveClass.approvalStatus === "approved" && liveClass.deliveryMode === "online") {
    card.append(createButton("Open class", () => void openTeacherClass(liveClass), "button button-orange"));
  }
  target.append(card);
}

async function loadTeacherStudio() {
  showMessage(document.querySelector("#teacher-class-message"), "Loading your teaching studio…");
  try {
    const profileRequest = teacherAccountRole === "teacher"
      ? requestJson("/api/teacher/profile")
      : Promise.resolve(null);
    const courseWorkflowRequest = teacherAccountRole === "teacher"
      ? Promise.all([
          requestJson("/api/teacher/programmes"),
          requestJson("/api/teacher/course-submissions"),
          requestJson("/api/teacher/capstones"),
          requestJson("/api/teacher/daily-answers"),
        ])
      : Promise.resolve([[], [], [], []]);
    const [modules, classes, materials, profile, locations, courseWorkflow] = await Promise.all([
      requestJson("/api/teacher/modules"),
      requestJson("/api/teacher/classes"),
      requestJson("/api/teacher/materials"),
      profileRequest,
      requestJson("/api/teacher/locations"),
      courseWorkflowRequest,
    ]);
    const [assignedProgrammes, courseSubmissions, capstones, dailyAnswers] = courseWorkflow;
    const upcomingClasses = getUpcomingTeacherClasses(classes);
    document.querySelector("#teacher-class-count").textContent = String(upcomingClasses.length);
    renderTeacherNextClass(upcomingClasses[0]);
    document.querySelector("#teacher-module-count").textContent = String(modules.length);
    document.querySelector("#teacher-material-count").textContent = String(materials.length);
    teacherLocations = locations;
    if (profile) {
      document.querySelector("#teacher-profile-title").value = profile.title;
      document.querySelector("#teacher-profile-biography").value = profile.biography;
      document.querySelector("#teacher-profile-qualifications").value = profile.qualifications;
      document.querySelector("#teacher-profile-photo-url").value = profile.photoUrl || "";
      setTeacherProfilePhotoPreview(profile.photoUrl || "");
      showMessage(
        document.querySelector("#teacher-profile-status"),
        profile.isVisible
          ? "Your profile is currently visible to learners."
          : "Your profile is private until an administrator publishes it.",
      );
    } else {
      teacherProfileForm.hidden = true;
    }
    const moduleSelect = document.querySelector("#live-module");
    moduleSelect.replaceChildren(
      ...modules.map((module) => {
        const option = node("option", "", `${module.programmeTitle} · Module ${module.position}: ${module.title}`);
        option.value = module.id;
        return option;
      }),
    );
    const scheduleButton = document.querySelector("#teacher-class-form button[type=submit]");
    scheduleButton.disabled = modules.length === 0;
    if (!modules.length) {
      moduleSelect.append(node("option", "", "An administrator must add a course module first"));
    }
    const locationSelect = document.querySelector("#live-location");
    const locationPlaceholder = node("option", "", locations.length ? "Choose a location" : "No active training locations");
    locationPlaceholder.value = "";
    locationSelect.replaceChildren(locationPlaceholder, ...locations.map((location) => {
      const option = node("option", "", `${location.city} · ${location.region}`);
      option.value = location.id;
      return option;
    }));
    document.querySelector("#material-assigned-course").textContent =
      assignedProgrammes[0]?.title || "No active course is assigned to your account.";
    document.querySelector("#teacher-material-form button[type=submit]").disabled =
      assignedProgrammes.length === 0;
    document.querySelector("#teacher-course-submission-form button[type=submit]").disabled =
      assignedProgrammes.length === 0;
    renderTeacherMaterials(materials);
    renderTeacherCourseSubmissions(courseSubmissions);
    renderTeacherCapstones(capstones);
    renderTeacherDailyAnswers(dailyAnswers);
    const moduleList = document.querySelector("#teacher-module-list");
    moduleList.replaceChildren();
    for (const module of modules) {
      const item = node("article", "teacher-module-card");
      const details = node("div");
      details.append(
        node("h3", "", `${module.programmeTitle} · Module ${module.position}: ${formatModuleTitle(module)}`),
        node("p", "", formatModuleSummary(module)),
      );
      item.append(
        details,
        renderTeacherModuleOutline(module),
        createButton("Open whiteboard", () => void openTeacherBoard(module), "small-action"),
      );
      moduleList.append(item);
    }
    const classList = document.querySelector("#teacher-class-list");
    classList.replaceChildren();
    if (!classes.length) classList.append(node("p", "admin-empty", "No upcoming live classes yet."));
    for (const liveClass of classes) {
      const item = node("article", "live-class-card");
      const details = node("div");
      details.append(
        node("h3", "", liveClass.title),
        node(
          "p",
          "",
          `${liveClass.programmeTitle} · ${liveClass.moduleTitle} · ${new Intl.DateTimeFormat("en-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(liveClass.startsAt))}`,
        ),
        node("span", liveClass.approvalStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
          liveClass.approvalStatus || "approved"),
        node("p", "admin-location-subtitle", liveClass.deliveryMode === "location"
          ? `TGFVP location · ${liveClass.locationName || "Location unavailable"}`
          : liveClass.deliveryMode === "venue"
            ? `Other venue · ${liveClass.venue}`
            : "Online meeting"),
      );
      if (liveClass.rejectionReason) details.append(node("p", "admin-message is-error", `Decline reason: ${liveClass.rejectionReason}`));
      item.append(details);
      if (liveClass.approvalStatus === "approved" && liveClass.deliveryMode === "online") {
        item.append(createButton("Open class", () => void openTeacherClass(liveClass), "button button-orange"));
      }
      item.append(
        createButton("Edit / resubmit", () => editTeacherClass(liveClass), "small-action"),
        createButton("Cancel", () => void cancelTeacherClass(liveClass), "small-action small-action-danger"),
      );
      classList.append(item);
    }
    resetTeacherClassEditor();
    syncTeacherClassFields();
    showMessage(document.querySelector("#teacher-class-message"), "");
  } catch (error) {
    showMessage(document.querySelector("#teacher-class-message"), error.message, true);
  }
}

function renderTeacherCourseSubmissions(submissions) {
  const list = document.querySelector("#teacher-course-submission-list");
  list.replaceChildren();
  if (!submissions.length) {
    list.append(node("p", "admin-empty", "You have not submitted a course document."));
    return;
  }
  for (const submission of submissions) {
    const card = node("article", "teacher-module-card");
    const details = node("div");
    const statusLabels = {
      pending: "Pending · Waiting for review",
      generating: "Curriculum draft in progress",
      drafted: "Draft ready · Waiting for approval",
      approved: "Approved · Modules available",
      rejected: "Rejected",
    };
    details.append(
      node("h3", "", submission.title),
      node("p", "admin-location-subtitle", `${submission.programmeTitle} · ${submission.originalFilename}`),
      node("span", submission.reviewStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
        statusLabels[submission.reviewStatus] || submission.reviewStatus),
    );
    if (submission.adminFeedback) details.append(node("p", "admin-location-subtitle", submission.adminFeedback));
    if (submission.generationError) details.append(node("p", "admin-message is-error", submission.generationError));
    card.append(details);
    if (submission.contentType?.startsWith("video/")) {
      card.append(createButton("Delete video", () => void deleteTeacherCourseSubmission(submission), "small-action small-action-danger"));
    }
    list.append(card);
  }
}

async function deleteTeacherCourseSubmission(submission) {
  const message = document.querySelector("#teacher-course-submission-message");
  if (!window.confirm(
    `Delete the uploaded video "${submission.title}"?${submission.reviewStatus === "approved" ? " Its approved course lessons will remain available." : ""}`,
  )) return;
  try {
    await requestJson("/api/teacher/course-submissions", {
      method: "DELETE",
      body: JSON.stringify({ id: submission.id }),
    });
    await loadTeacherStudio();
    showMessage(message, "Uploaded video deleted.");
  } catch (error) {
    showMessage(message, error.message, true);
  }
}

function renderTeacherCapstones(submissions) {
  const list = document.querySelector("#teacher-capstone-list");
  list.replaceChildren();
  if (!submissions.length) {
    list.append(node("p", "admin-empty", "There are no capstone submissions to review."));
    return;
  }
  for (const submission of submissions) {
    const card = node("article", "teacher-module-card");
    const details = node("div");
    details.append(
      node("h3", "", `${submission.learnerName} · ${submission.programmeTitle}`),
      node("p", "admin-location-subtitle",
        `Module ${submission.modulePosition}: ${submission.moduleTitle} · Attempt ${submission.submissionNumber}`),
      node("span", submission.reviewStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
        submission.reviewStatus.replaceAll("_", " ")),
    );
    if (submission.responseText) details.append(node("p", "", submission.responseText));
    if (submission.originalFilename && submission.fileUrl) {
      const link = node("a", "small-action", `View ${submission.originalFilename}`);
      link.href = submission.fileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      details.append(link);
    }
    if (submission.teacherFeedback) {
      details.append(node("p", "admin-location-subtitle", `Previous feedback: ${submission.teacherFeedback}`));
    }
    card.append(details);
    if (submission.reviewStatus === "submitted") {
      const actions = node("div", "admin-user-controls");
      const approve = createButton("Approve capstone", () =>
        void reviewTeacherCapstone(submission, "approve", approve), "small-action");
      const changes = createButton("Require changes", () =>
        void reviewTeacherCapstone(submission, "request_changes", changes), "small-action small-action-danger");
      actions.append(approve, changes);
      card.append(actions);
    }
    list.append(card);
  }
}

async function reviewTeacherCapstone(submission, action, button) {
  let feedback = "";
  if (action === "request_changes") {
    feedback = window.prompt(`What should ${submission.learnerName} change?`) || "";
    feedback = feedback.trim();
    if (feedback.length < 5 || feedback.length > 2000) {
      showMessage(document.querySelector("#teacher-capstone-message"),
        "Enter required changes between 5 and 2000 characters.", true);
      return;
    }
  } else if (!window.confirm(`Approve ${submission.learnerName}'s capstone and unlock the next module?`)) {
    return;
  }
  button.disabled = true;
  try {
    const result = await requestJson(`/api/teacher/capstones/${encodeURIComponent(submission.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, feedback }),
    });
    await loadTeacherStudio();
    showMessage(document.querySelector("#teacher-capstone-message"),
      result.courseCompleted
        ? "Capstone approved. The learner has completed the programme."
        : action === "approve"
          ? "Capstone approved. The next module is now released."
          : "Changes requested. The learner can revise and resubmit.");
  } catch (error) {
    showMessage(document.querySelector("#teacher-capstone-message"), error.message, true);
    button.disabled = false;
  }
}

function renderTeacherDailyAnswers(submissions) {
  const list = document.querySelector("#teacher-daily-answer-list");
  list.replaceChildren();
  if (!submissions.length) {
    list.append(node("p", "admin-empty", "There are no daily answers to review."));
    return;
  }
  for (const submission of submissions) {
    const card = node("article", "teacher-module-card");
    const details = node("div");
    details.append(
      node("h3", "", `${submission.learnerName} · ${submission.programmeTitle}`),
      node(
        "p",
        "admin-location-subtitle",
        `Module ${submission.modulePosition}: ${submission.moduleTitle} · Week ${submission.weekNumber}, Day ${submission.dayNumber} · Attempt ${submission.submissionNumber}`,
      ),
      node("span", submission.reviewStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
        submission.reviewStatus.replaceAll("_", " ")),
      node("p", "", submission.responseText),
    );
    if (submission.teacherFeedback) {
      details.append(node("p", "admin-location-subtitle", `Previous feedback: ${submission.teacherFeedback}`));
    }
    card.append(details);
    if (submission.reviewStatus === "submitted") {
      const actions = node("div", "admin-user-controls");
      const approve = createButton("Approve answer", () =>
        void reviewTeacherDailyAnswer(submission, "approve", approve), "small-action");
      const changes = createButton("Require changes", () =>
        void reviewTeacherDailyAnswer(submission, "request_changes", changes), "small-action small-action-danger");
      actions.append(approve, changes);
      card.append(actions);
    }
    list.append(card);
  }
}

async function reviewTeacherDailyAnswer(submission, action, button) {
  let feedback = "";
  if (action === "request_changes") {
    feedback = window.prompt(`What should ${submission.learnerName} change in this daily answer?`) || "";
    feedback = feedback.trim();
    if (feedback.length < 5 || feedback.length > 2000) {
      showMessage(document.querySelector("#teacher-daily-answer-message"),
        "Enter required changes between 5 and 2000 characters.", true);
      return;
    }
  } else if (!window.confirm(`Approve this daily answer from ${submission.learnerName}?`)) {
    return;
  }
  button.disabled = true;
  try {
    await requestJson(`/api/teacher/daily-answers/${encodeURIComponent(submission.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, feedback }),
    });
    await loadTeacherStudio();
    showMessage(document.querySelector("#teacher-daily-answer-message"),
      action === "approve"
        ? "Daily answer approved."
        : "Changes requested. The learner can revise and resubmit.");
  } catch (error) {
    showMessage(document.querySelector("#teacher-daily-answer-message"), error.message, true);
    button.disabled = false;
  }
}

function renderTeacherMaterials(materials) {
  const list = document.querySelector("#teacher-material-list");
  list.replaceChildren();
  if (!materials.length) {
    list.append(node("p", "admin-empty", "You have not submitted any learning materials."));
    return;
  }
  for (const material of materials) {
    const card = node("article", "teacher-module-card");
    const details = node("div");
    details.append(
      node("h3", "", material.title),
      node("p", "admin-location-subtitle", `${material.programmeTitle} · ${material.moduleTitle || "Awaiting module assignment"} · ${material.originalFilename}`),
      node("span", material.reviewStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden", material.reviewStatus),
    );
    if (material.adminFeedback) details.append(node("p", "admin-location-subtitle", material.adminFeedback));
    const link = node("a", "small-action", "View document");
    link.href = material.fileUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(details, link);
    list.append(card);
  }
}

function renderTeacherModuleOutline(module) {
  const weeks = module.weeks || [];
  const outline = node("details", "teacher-module-outline");
  outline.append(node(
    "summary",
    "teacher-module-outline-summary",
    weeks.length
      ? `View course outline · ${weeks.length} weeks, ${weeks.length * 5} study days`
      : "Course outline not available yet",
  ));
  if (!weeks.length) return outline;

  if (hasSourceExtractionWarning(module)) {
    outline.append(node(
      "p",
      "course-source-warning",
      "Automatic text extraction could not read this source. The assigned page links open the original document; use it for the lesson content and its questions.",
    ));
  }

  const weekList = node("div", "teacher-module-outline-weeks");
  for (const week of weeks) {
    const card = node("section", "teacher-outline-week");
    card.append(
      node("p", "micro-label", `Week ${week.weekNumber}`),
      node("h4", "", formatWeekTitle(week)),
    );
    const description = stripSourceExtractionWarning(week.description);
    if (description) {
      card.append(lessonTextNode("p", "", description, week.materials?.[0]?.fileUrl));
    }
    if (week.learningObjectives) {
      card.append(lessonTextNode(
        "p",
        "admin-location-subtitle",
        `Learning objectives: ${week.learningObjectives}`,
        week.materials?.[0]?.fileUrl,
      ));
    }
    if (week.lessonContent) {
      card.append(renderWeekLessonContent(week.lessonContent, week));
    }
    if (!parseWeekDayMarkers(week.lessonContent)) {
      for (const material of week.materials || []) {
        if (!material.fileUrl) continue;
        const link = node("a", "small-action module-day-source", "Open original document");
        const pageRange = pageRangeForWeek(week);
        const isPdf = /\.pdf$/i.test(material.originalFilename || "");
        link.href = `${material.fileUrl}${isPdf && pageRange ? `#page=${pageRange.start}` : ""}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.append(link);
      }
    }
    weekList.append(card);
  }
  outline.append(weekList);
  return outline;
}

async function submitTeacherCourseContent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const file = form.elements.file.files?.[0];
  if (!file) return;
  const videoFormat = /\.(mp4|mov|webm)$/i.exec(file.name)?.[1]?.toLowerCase();
  const isVideo = Boolean(videoFormat);
  const maxBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    showMessage(document.querySelector("#teacher-course-submission-message"),
      isVideo ? "Videos must be 100 MB or smaller." : "Documents must be 10 MB or smaller.", true);
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const message = document.querySelector("#teacher-course-submission-message");
  let uploadPublicId = "";
  try {
    if (isVideo) {
      const durationSeconds = await readCourseVideoDuration(file);
      const signature = await requestJson("/api/teacher/course-submissions/upload-signature", {
        method: "POST",
        body: JSON.stringify({ format: videoFormat }),
      });
      uploadPublicId = signature.publicId;
      await uploadCourseVideoToCloudinary(file, signature, (percent) => {
        showMessage(message, `Uploading video directly to secure storage… ${percent}%`);
      });
      await requestJson("/api/teacher/course-submissions/upload", {
        method: "POST",
        body: JSON.stringify({
          title: form.elements.title.value,
          originalFilename: file.name,
          fileSize: file.size,
          durationSeconds,
          publicId: signature.publicId,
          format: videoFormat,
        }),
      });
      uploadPublicId = "";
    } else {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Documents must be 10 MB or smaller.");
      }
      const data = new FormData();
      data.set("title", form.elements.title.value);
      data.set("file", file);
      showMessage(message, "Uploading private course content…");
      await requestJson("/api/teacher/course-submissions", { method: "POST", body: data });
    }
    form.reset();
    await loadTeacherStudio();
    showMessage(document.querySelector("#teacher-course-submission-message"),
      "Submitted · Pending admin review. Modules and weekly blocks will appear here only after approval.");
  } catch (error) {
    if (uploadPublicId) {
      try {
        await requestJson("/api/teacher/course-submissions/upload", {
          method: "DELETE",
          body: JSON.stringify({ publicId: uploadPublicId }),
        });
      } catch {
        showMessage(message, `${error.message} The upload status is uncertain; refresh your submissions before trying again.`, true);
        return;
      }
    }
    showMessage(message, error.message, true);
  } finally {
    button.disabled = false;
  }
}

function readCourseVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (error, duration) => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      if (error) reject(error);
      else resolve(duration);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Math.ceil(video.duration);
      if (!Number.isFinite(duration) || duration < 1 || duration > 86400) {
        finish(new Error("Choose a video between 1 second and 24 hours long."));
        return;
      }
      finish(null, duration);
    };
    video.onerror = () => finish(new Error("The video duration could not be read. Check the file and try again."));
    video.src = objectUrl;
  });
}

function uploadCourseVideoToCloudinary(file, signature, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("file", file);
    form.set("api_key", signature.apiKey);
    form.set("timestamp", String(signature.timestamp));
    form.set("type", "authenticated");
    form.set("public_id", signature.publicId);
    form.set("signature", signature.signature);
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/raw/upload`,
    );
    request.timeout = 10 * 60 * 1000;
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener("load", () => {
      let result;
      try {
        result = JSON.parse(request.responseText);
      } catch {
        reject(new Error("Secure storage returned an unreadable upload response."));
        return;
      }
      if (request.status < 200 || request.status >= 300 || result.error) {
        reject(new Error("The video could not be uploaded. Check your connection and try again."));
        return;
      }
      onProgress(100);
      resolve(result);
    });
    request.addEventListener("error", () => reject(new Error("The video upload failed. Check your connection and try again.")));
    request.addEventListener("timeout", () => reject(new Error("The video upload timed out. Check your connection and try again.")));
    request.addEventListener("abort", () => reject(new Error("The video upload was cancelled.")));
    request.send(form);
  });
}

async function submitTeacherMaterial(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const file = document.querySelector("#material-file").files?.[0];
  if (!file) return;
  const button = form.querySelector('button[type="submit"]');
  const message = document.querySelector("#teacher-material-message");
  button.disabled = true;
  showMessage(message, "Uploading private learning material…");
  const data = new FormData();
  data.set("title", document.querySelector("#material-title").value);
  data.set("description", document.querySelector("#material-description").value);
  data.set("file", file);
  try {
    await requestJson("/api/teacher/materials", { method: "POST", body: data });
    form.reset();
    await loadTeacherStudio();
    showMessage(message, "Material submitted. The administrator will choose its module and weekly block before approval.");
  } catch (error) {
    showMessage(message, error.message, true);
  } finally {
    button.disabled = false;
  }
}

function syncTeacherClassFields() {
  const mode = document.querySelector("#live-delivery-mode").value;
  for (const field of teacherClassForm.querySelectorAll("[data-teacher-class-field]")) {
    field.hidden = field.dataset.teacherClassField !== mode;
  }
  document.querySelector("#live-meeting-url").required = mode === "online";
  document.querySelector("#live-location").required = mode === "location";
  document.querySelector("#live-venue").required = mode === "venue";
}

function resetTeacherClassEditor() {
  teacherClassForm.reset();
  document.querySelector("#teacher-class-edit-id").value = "";
  document.querySelector("#teacher-class-form-heading").textContent = "Schedule a live class";
  document.querySelector("#cancel-teacher-class-edit").hidden = true;
  teacherClassForm.querySelector('button[type="submit"]').textContent = "Schedule class";
  showMessage(document.querySelector("#teacher-class-edit-message"), "");
}

function editTeacherClass(liveClass) {
  const date = new Date(liveClass.startsAt);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  document.querySelector("#teacher-class-edit-id").value = liveClass.id;
  document.querySelector("#teacher-class-form-heading").textContent =
    liveClass.approvalStatus === "rejected" ? "Update and resubmit declined class" : "Edit and resubmit class";
  document.querySelector("#live-module").value = liveClass.moduleId;
  document.querySelector("#live-class-title").value = liveClass.title;
  document.querySelector("#live-start-time").value = date.toISOString().slice(0, 16);
  document.querySelector("#live-delivery-mode").value = liveClass.deliveryMode || "online";
  document.querySelector("#live-meeting-url").value = liveClass.meetingUrl || "";
  document.querySelector("#live-location").value = liveClass.locationId || "";
  document.querySelector("#live-venue").value = liveClass.venue || "";
  document.querySelector("#cancel-teacher-class-edit").hidden = false;
  teacherClassForm.querySelector('button[type="submit"]').textContent = "Save and resubmit";
  syncTeacherClassFields();
  teacherClassForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function scheduleTeacherClass(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  const editId = document.querySelector("#teacher-class-edit-id").value;
  const mode = document.querySelector("#live-delivery-mode").value;
  showMessage(document.querySelector("#teacher-class-message"), editId ? "Updating class for review…" : "Scheduling live class…");
  try {
    await requestJson(editId
      ? `/api/teacher/classes/${encodeURIComponent(editId)}`
      : "/api/teacher/classes", {
      method: editId ? "PATCH" : "POST",
      body: JSON.stringify({
        moduleId: document.querySelector("#live-module").value,
        title: document.querySelector("#live-class-title").value,
        startsAt: new Date(document.querySelector("#live-start-time").value).toISOString(),
        deliveryMode: mode,
        meetingUrl: mode === "online" ? document.querySelector("#live-meeting-url").value : "",
        locationId: mode === "location" ? document.querySelector("#live-location").value : "",
        venue: mode === "venue" ? document.querySelector("#live-venue").value : "",
      }),
    });
    await loadTeacherStudio();
    showMessage(document.querySelector("#teacher-class-message"),
      editId ? "Class updated and resubmitted for administrator approval." : "Class submitted for administrator approval.");
  } catch (error) {
    showMessage(document.querySelector("#teacher-class-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function saveTeacherProfile(event) {
  event.preventDefault();
  const button = teacherProfileForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage(document.querySelector("#teacher-profile-message"), "Saving profile…");
  try {
    let photoUrl = document.querySelector("#teacher-profile-photo-url").value;
    if (teacherProfilePhotoFile) {
      showMessage(document.querySelector("#teacher-profile-message"), "Uploading profile photo…");
      photoUrl = await uploadTeacherProfilePhoto(teacherProfilePhotoFile);
      document.querySelector("#teacher-profile-photo-url").value = photoUrl;
      teacherProfilePhotoFile = null;
      document.querySelector("#teacher-profile-photo").value = "";
      setTeacherProfilePhotoPreview(photoUrl);
    }
    const profile = await requestJson("/api/teacher/profile", {
      method: "PATCH",
      body: JSON.stringify({
        title: document.querySelector("#teacher-profile-title").value,
        biography: document.querySelector("#teacher-profile-biography").value,
        qualifications: document.querySelector("#teacher-profile-qualifications").value,
        photoUrl,
      }),
    });
    document.querySelector("#teacher-profile-photo-url").value = profile.photoUrl || photoUrl;
    setTeacherProfilePhotoPreview(profile.photoUrl || photoUrl);
    showMessage(
      document.querySelector("#teacher-profile-status"),
      profile.isVisible
        ? "Your profile is currently visible to learners. Updates do not change administrator visibility."
        : "Your profile is private until an administrator publishes it.",
    );
    showMessage(document.querySelector("#teacher-profile-message"), "Profile saved.");
  } catch (error) {
    showMessage(document.querySelector("#teacher-profile-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
}

function setTeacherProfilePhotoPreview(source) {
  const preview = document.querySelector("#teacher-profile-photo-preview");
  if (teacherProfilePhotoPreviewUrl) {
    URL.revokeObjectURL(teacherProfilePhotoPreviewUrl);
    teacherProfilePhotoPreviewUrl = "";
  }
  if (!source) {
    preview.removeAttribute("src");
    preview.hidden = true;
    return;
  }
  preview.src = source;
  preview.hidden = false;
}

async function uploadTeacherProfilePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG or WebP profile photo no larger than 5 MB.");
  }
  const signature = await requestJson("/api/teacher/profile-photo-signature", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("folder", signature.folder);
  formData.append("upload_preset", signature.uploadPreset);
  formData.append("signature", signature.signature);

  let response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,
      { method: "POST", body: formData },
    );
  } catch {
    throw new Error("Profile photo upload failed. Check your connection and try again.");
  }
  let uploaded;
  try {
    uploaded = await response.json();
  } catch {
    throw new Error("The photo service returned an unreadable response.");
  }
  if (!response.ok || typeof uploaded.secure_url !== "string" ||
      !uploaded.secure_url.startsWith("https://res.cloudinary.com/") ||
      !uploaded.secure_url.includes(`/${signature.folder}/`)) {
    throw new Error("The profile photo could not be uploaded.");
  }
  return uploaded.secure_url;
}

function handleTeacherProfilePhotoChange(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size <= 0 || file.size > 5 * 1024 * 1024) {
    event.currentTarget.value = "";
    teacherProfilePhotoFile = null;
    showMessage(document.querySelector("#teacher-profile-message"),
      "Choose a JPG, PNG or WebP profile photo no larger than 5 MB.", true);
    return;
  }
  teacherProfilePhotoFile = file;
  if (teacherProfilePhotoPreviewUrl) URL.revokeObjectURL(teacherProfilePhotoPreviewUrl);
  teacherProfilePhotoPreviewUrl = URL.createObjectURL(file);
  document.querySelector("#teacher-profile-photo-preview").src = teacherProfilePhotoPreviewUrl;
  document.querySelector("#teacher-profile-photo-preview").hidden = false;
  showMessage(document.querySelector("#teacher-profile-message"), "Photo selected. Save your profile to upload it.");
}

async function cancelTeacherClass(liveClass) {
  if (!window.confirm(`Cancel ${liveClass.title}?`)) return;
  try {
    await requestJson(`/api/teacher/classes/${encodeURIComponent(liveClass.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
    await loadTeacherStudio();
  } catch (error) {
    showMessage(document.querySelector("#teacher-class-message"), error.message, true);
  }
}

async function openTeacherClass(liveClass) {
  try {
    const result = await requestJson(`/api/live-classes/${encodeURIComponent(liveClass.id)}`);
    teacherDashboard.hidden = true;
    teacherLiveRoom.hidden = false;
    document.querySelector("#teacher-live-title").textContent = liveClass.title;
    document.querySelector("#teacher-live-link").href = result.meetingUrl;
  } catch (error) {
    showMessage(document.querySelector("#teacher-class-message"), error.message, true);
  }
}

let activeBoardRefresh;
let activeBoardPoll;
let activeCanvasState;
const configuredCanvases = new WeakMap();

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

function drawBoard(canvas, strokes) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (!stroke.points?.length) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.beginPath();
    context.moveTo(stroke.points[0].x * rect.width, stroke.points[0].y * rect.height);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x * rect.width, point.y * rect.height);
    }
    if (stroke.points.length === 1) {
      context.lineTo(stroke.points[0].x * rect.width + 0.1, stroke.points[0].y * rect.height + 0.1);
    }
    context.stroke();
  }
}

function configureCanvas(canvasId, editable) {
  const canvas = document.querySelector(`#${canvasId}`);
  if (!(canvas instanceof HTMLCanvasElement)) return;
  let state = configuredCanvases.get(canvas);
  if (!state) {
    state = { strokes: [], drawing: false, lastStrokeCount: 0, configured: false };
    configuredCanvases.set(canvas, state);
  }
  activeCanvasState = state;
  drawBoard(canvas, state.strokes);
  if (!editable || state.configured) return;
  state.configured = true;

  const finish = () => {
    state.drawing = false;
    if (state.strokes.length > state.lastStrokeCount) {
      state.lastStrokeCount = state.strokes.length;
      scheduleBoardSave();
    }
  };
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const color = document.querySelector("#board-color").value;
    const width = Number(document.querySelector("#board-width").value);
    state.strokes.push({ color, width, points: [canvasPoint(canvas, event)] });
    state.lastStrokeCount = state.strokes.length - 1;
    drawBoard(canvas, state.strokes);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing) return;
    state.strokes[state.strokes.length - 1].points.push(canvasPoint(canvas, event));
    drawBoard(canvas, state.strokes);
  });
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
  canvas.addEventListener("lostpointercapture", finish);
  window.addEventListener("resize", () => drawBoard(canvas, state.strokes));
}

async function loadBoard(moduleId, canvasId) {
  const result = await requestJson(`/api/modules/${encodeURIComponent(moduleId)}/board`);
  const canvas = document.querySelector(`#${canvasId}`);
  const state = activeCanvasState;
  if (state && canvas) {
    state.strokes = result.strokes;
    state.lastStrokeCount = result.strokes.length;
    drawBoard(canvas, state.strokes);
  }
}

function startBoardRefresh(moduleId, canvasId) {
  stopBoardRefresh();
  activeBoardRefresh = moduleId;
  activeBoardPoll = window.setInterval(async () => {
    if (activeBoardRefresh !== moduleId) return;
    try {
      const result = await requestJson(`/api/modules/${encodeURIComponent(moduleId)}/board`);
      const canvas = document.querySelector(`#${canvasId}`);
      if (canvas && activeCanvasState) {
        activeCanvasState.strokes = result.strokes;
        activeCanvasState.lastStrokeCount = result.strokes.length;
        drawBoard(canvas, result.strokes);
      }
    } catch (error) {
      showMessage(document.querySelector("#module-message"), error.message, true);
      stopBoardRefresh();
    }
  }, 5000);
}

function stopBoardRefresh() {
  if (activeBoardPoll) window.clearInterval(activeBoardPoll);
  activeBoardRefresh = undefined;
  activeBoardPoll = undefined;
}

let boardSaveTimer;
function scheduleBoardSave() {
  if (!teacherRoom || teacherRoom.hidden) return;
  window.clearTimeout(boardSaveTimer);
  boardSaveTimer = window.setTimeout(() => void saveTeacherBoard(), 800);
}

async function saveTeacherBoard() {
  if (!activeCanvasState || !teacherRoom || teacherRoom.hidden) return;
  const button = document.querySelector("#board-save");
  button.disabled = true;
  showMessage(document.querySelector("#board-message"), "Saving shared whiteboard…");
  try {
    await requestJson(`/api/modules/${encodeURIComponent(teacherRoom.dataset.moduleId)}/board`, {
      method: "PUT",
      body: JSON.stringify({ strokes: activeCanvasState.strokes }),
    });
    showMessage(document.querySelector("#board-message"), "Whiteboard saved and shared with your learners.");
  } catch (error) {
    showMessage(document.querySelector("#board-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function openTeacherBoard(module) {
  stopBoardRefresh();
  teacherDashboard.hidden = true;
  teacherRoom.hidden = false;
  teacherRoom.dataset.moduleId = module.id;
  document.querySelector("#teacher-room-title").textContent =
    `${module.programmeTitle} · Module ${module.position}: ${module.title}`;
  configureCanvas("teacher-board-canvas", true);
  try {
    await loadBoard(module.id, "teacher-board-canvas");
    showMessage(document.querySelector("#board-message"), "Teacher whiteboard ready.");
  } catch (error) {
    showMessage(document.querySelector("#board-message"), error.message, true);
  }
}

async function showClassroom(account) {
  if (paths) {
    paths.loginPanel.hidden = true;
    paths.dashboard.hidden = isStudentPage;
  }
  classroomSignOut.hidden = false;
  if (isStudentPage) {
    studentPaymentProof.addEventListener("change", () => void submitStudentPaymentProof());
    if (account.role !== "learner") {
      showClassroomLogin("This page is for student accounts. Use your team portal for staff access.", true);
      return;
    }
    if (account.accountStatus !== "active") {
      const loginForm = document.querySelector("#student-login-form");
      const registerForm = document.querySelector("#student-register-form");
      const intro = studentLoginPanel.querySelector(".admin-intro");
      studentLoginPanel.hidden = false;
      studentDashboard.hidden = true;
      studentEnrollmentPanel.hidden = true;
      studentPendingPanel.hidden = true;
      studentAccountStatusMessage.hidden = false;
      loginForm.hidden = true;
      classroomSignOut.hidden = false;
      if (account.accountStatus === "rejected") {
        studentAccountStatusMessage.textContent = account.rejectionReason
          ? `Your registration was rejected: ${account.rejectionReason} You may submit a new registration below.`
          : "Your registration was rejected. You may submit a new registration below.";
        intro.textContent = "Create a new student account to request approval again.";
        registerForm.hidden = false;
        registerForm.elements.fullName.value = account.fullName;
        registerForm.elements.email.value = account.email;
        registerForm.elements.whatsappNumber.value = account.whatsappNumber || "";
      } else {
        studentAccountStatusMessage.textContent = "Your account is awaiting admin approval. You cannot access the student dashboard until your account is approved.";
        intro.textContent = "Your registration is being reviewed by the TGFVP administrator.";
        registerForm.hidden = true;
      }
      return;
    }
    studentAccountStatusMessage.hidden = true;
    document.querySelector("#student-login-form").hidden = false;
    document.querySelector("#student-register-form").hidden = false;
    document.querySelector("#student-display-name").textContent = account.fullName;
    window.dispatchEvent(new Event("tgf-account-authenticated"));
    await loadStudentCourses();
  } else if (isTeacherPage) {
    if (account.role !== "teacher" && account.role !== "administrator") {
      showClassroomLogin("This page is for teacher accounts. Use your student learning space for learner access.", true);
      return;
    }
    document.querySelector("#teacher-display-name").textContent = account.fullName;
    teacherAccountRole = account.role;
    document.querySelector("#teacher-admin-link").hidden = account.role !== "administrator";
    if (account.role !== "administrator") window.dispatchEvent(new Event("tgf-account-authenticated"));
    await loadTeacherStudio();
  }
}

async function loadClassroomSession() {
  try {
    const account = await requestJson(paths.session);
    if (account.mustChangePassword) {
      showClassroomLogin("Please update your temporary password in the team portal before opening your classroom.", true);
      return;
    }
    await showClassroom(account);
  } catch {
    showClassroomLogin();
  }
}

if (paths) {
  paths.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!paths.loginForm.reportValidity()) return;
    const form = paths.loginForm;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage(paths.loginMessage, "");
    try {
      await requestJson(paths.login, {
        method: "POST",
        body: JSON.stringify({
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        }),
      });
      form.reset();
      await loadClassroomSession();
    } catch (error) {
      showMessage(paths.loginMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

const registerForm = document.querySelector("#student-register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!registerForm.reportValidity()) return;
    const button = registerForm.querySelector("button[type=submit]");
    button.disabled = true;
    const message = document.querySelector("#student-register-message");
    showMessage(message, "");
    try {
      await requestJson("/api/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: registerForm.elements.fullName.value.trim(),
          gender: registerForm.elements.gender.value,
          email: registerForm.elements.email.value.trim(),
          whatsappNumber: registerForm.elements.whatsappNumber.value.trim(),
          password: registerForm.elements.password.value,
        }),
      });
      registerForm.reset();
      await loadClassroomSession();
    } catch (error) {
      showMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

if (isStudentPage) {
  document.querySelector("#complete-module").addEventListener("click", completeStudentModule);
  window.setInterval(() => void refreshStudentPaymentStatus(), 15000);
  window.setInterval(() => void refreshStudentLessonProgress(), 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshStudentPaymentStatus();
      void refreshStudentLessonProgress();
    }
  });
  document.querySelector("#student-module-weeks").addEventListener("submit", (event) => {
    if (event.target.id === "student-capstone-form") void submitStudentCapstone(event);
    if (event.target.matches(".daily-answer-form")) void submitStudentDailyAnswer(event);
  });
  document.querySelector("#close-student-lesson").addEventListener("click", () => {
    stopBoardRefresh();
    studentLessonPanel.hidden = true;
    studentDashboard.hidden = false;
    void loadStudentCourses();
  });
  document.querySelector("#close-live-room").addEventListener("click", () => {
    stopBoardRefresh();
    stopStudentPresence();
    studentLiveRoom.hidden = true;
    studentDashboard.hidden = false;
  });
  document.querySelector("#student-refresh-enrollments").addEventListener("click", () => {
    void loadStudentCourses();
  });
  document.querySelector("[data-student-progress-refresh]")?.addEventListener("click", () => {
    void refreshStudentLearningProgress();
  });
  document.querySelector('a[href="#student-attendance"]')?.addEventListener("click", () => {
    if (!studentDashboard.hidden) void refreshStudentLearningProgress();
  });
}

const studentLiveRoom = document.querySelector("#live-room");
if (isTeacherPage) {
  window.setInterval(() => void refreshTeacherDailyAnswers(), 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshTeacherDailyAnswers();
  });
  teacherClassForm.addEventListener("submit", scheduleTeacherClass);
  teacherProfileForm.addEventListener("submit", saveTeacherProfile);
  document.querySelector("#teacher-profile-photo").addEventListener("change", handleTeacherProfilePhotoChange);
  document.querySelector("#live-delivery-mode").addEventListener("change", syncTeacherClassFields);
  document.querySelector("#cancel-teacher-class-edit").addEventListener("click", resetTeacherClassEditor);
  document.querySelector("#teacher-material-form").addEventListener("submit", submitTeacherMaterial);
  document.querySelector("#teacher-course-submission-form").addEventListener("submit", submitTeacherCourseContent);
  document.querySelector("#board-save").addEventListener("click", () => void saveTeacherBoard());
  document.querySelector("#board-undo").addEventListener("click", () => {
    if (!activeCanvasState) return;
    activeCanvasState.strokes.pop();
    drawBoard(document.querySelector("#teacher-board-canvas"), activeCanvasState.strokes);
    void saveTeacherBoard();
  });
  document.querySelector("#board-clear").addEventListener("click", () => {
    if (!window.confirm("Clear and save the shared classroom whiteboard?")) return;
    activeCanvasState.strokes = [];
    drawBoard(document.querySelector("#teacher-board-canvas"), []);
    void saveTeacherBoard();
  });
  document.querySelector("#close-teacher-room").addEventListener("click", () => {
    teacherRoom.hidden = true;
    teacherDashboard.hidden = false;
    activeCanvasState = undefined;
  });
  document.querySelector("#close-teacher-live").addEventListener("click", () => {
    teacherLiveRoom.hidden = true;
    teacherDashboard.hidden = false;
  });
}

classroomSignOut.addEventListener("click", async () => {
  classroomSignOut.disabled = true;
  stopBoardRefresh();
  stopStudentPresence();
  try {
    await requestJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    showClassroomLogin();
  } catch (error) {
    showMessage(
      document.querySelector(isStudentPage ? "#student-course-message" : "#teacher-class-message"),
      error.message,
      true,
    );
  } finally {
    classroomSignOut.disabled = false;
  }
});

void loadClassroomSession();
