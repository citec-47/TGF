const loginPanel = document.querySelector("#login-panel");
const dashboardPanel = document.querySelector("#dashboard-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const adminShell = document.querySelector(".admin-page");
const adminThemeToggle = document.querySelector("#admin-theme-toggle");
const credentialEmail = document.querySelector("#credential-email");
const credentialLoginLink = document.querySelector("#credential-login-link");
const credentialPasswordHint = document.querySelector("#credential-password-hint");
const credentialMessage = document.querySelector("#credential-message");
const locationList = document.querySelector("#admin-location-list");
const locationCount = document.querySelector("#location-count");
const editorPanel = document.querySelector("#editor-panel");
const editorHeading = document.querySelector("#editor-heading");
const locationForm = document.querySelector("#location-form");
const locationIdField = document.querySelector("#location-id");
const cityField = document.querySelector("#location-city");
const regionField = document.querySelector("#location-region");
const addressField = document.querySelector("#location-address");
const descriptionField = document.querySelector("#location-description");
const sortOrderField = document.querySelector("#location-sort-order");
const activeField = document.querySelector("#location-active");
const imageUrlField = document.querySelector("#location-image-url");
const photoField = document.querySelector("#location-photo");
const photoPreviewWrap = document.querySelector("#photo-preview-wrap");
const photoPreview = document.querySelector("#photo-preview");
const formMessage = document.querySelector("#form-message");
const saveButton = document.querySelector("#save-location");
const signOutButton = document.querySelector("#sign-out");
const userList = document.querySelector("#admin-user-list");
const userCount = document.querySelector("#account-count");
const accountMessage = document.querySelector("#account-message");
const credentialCard = document.querySelector("#account-credential");
const credentialName = document.querySelector("#credential-name");
const credentialPassword = document.querySelector("#credential-password");
const accountForm = document.querySelector("#account-form");
const accountFormMessage = document.querySelector("#account-form-message");
const teacherAccountForm = document.querySelector("#teacher-account-form");
const teacherAccountFormMessage = document.querySelector("#teacher-account-form-message");
const accountPasswordDialog = document.querySelector("#account-password-dialog");
const accountPasswordForm = document.querySelector("#account-password-form");
const accountPasswordInput = document.querySelector("#account-new-password");
const accountPasswordConfirmation = document.querySelector("#account-confirm-password");
const accountPasswordMessage = document.querySelector("#account-password-message");
const saveAccountPasswordButton = document.querySelector("#save-account-password");
const settingsForm = document.querySelector("#settings-form");
const settingsMessage = document.querySelector("#settings-message");
const flyerFile = document.querySelector("#flyer-file");
const flyerImageUrl = document.querySelector("#flyer-image-url");
const flyerPreview = document.querySelector("#flyer-preview");
const flyerPreviewWrap = document.querySelector("#flyer-preview-wrap");
const flyerHistoryList = document.querySelector("#flyer-history-list");
const flyerHistoryMessage = document.querySelector("#flyer-history-message");
const flyerDateField = document.querySelector("#flyer-date-text");
const flyerPreviewDate = document.querySelector("#flyer-preview-date");
const saveSettingsButton = document.querySelector("#save-settings");
const boardList = document.querySelector("#board-member-list");
const boardCount = document.querySelector("#board-count");
const boardMessage = document.querySelector("#board-message");
const boardForm = document.querySelector("#board-member-form");
const boardFormMessage = document.querySelector("#board-form-message");
const boardPhoto = document.querySelector("#board-member-photo");
const boardPhotoUrl = document.querySelector("#board-member-photo-url");
const boardPhotoPreview = document.querySelector("#board-photo-preview");
const boardPhotoPreviewWrap = document.querySelector("#board-photo-preview-wrap");
const courseList = document.querySelector("#course-admin-list");
const courseMessage = document.querySelector("#course-message");
const courseSubmissionList = document.querySelector("#course-submission-list");
const courseSubmissionsMessage = document.querySelector("#course-submissions-message");
const programmeForm = document.querySelector("#programme-form");
const moduleForm = document.querySelector("#module-form");
const moduleFormMessage = document.querySelector("#module-form-message");
const adminSidebarNav = document.querySelector("#admin-sidebar-nav");
const adminWorkspace = document.querySelector("#admin-workspace");
const enrollmentList = document.querySelector("#enrollment-request-list");
const enrollmentCount = document.querySelector("#enrollment-count");
const enrollmentNavCount = document.querySelector("#enrollment-nav-count");
const enrollmentMessage = document.querySelector("#enrollment-message");
const paymentsList = document.querySelector("#payment-management-list");
const paymentsMessage = document.querySelector("#payments-message");
const paymentStatusFilter = document.querySelector("#payment-status-filter");
const paymentSearch = document.querySelector("#payment-search");
const paymentReceiptList = document.querySelector("#payment-receipt-list");
const paymentReceiptCount = document.querySelector("#payment-receipt-count");
const paymentReceiptStatusFilter = document.querySelector("#payment-receipt-status-filter");
const paymentRecordCount = document.querySelector("#payment-record-count");
const rejectionReasonDialog = document.querySelector("#rejection-reason-dialog");
const rejectionReasonForm = document.querySelector("#rejection-reason-form");
const rejectionReasonTemplate = document.querySelector("#rejection-reason-template");
const rejectionReasonText = document.querySelector("#rejection-reason-text");
const rejectionReasonMessage = document.querySelector("#rejection-reason-message");
const materialsList = document.querySelector("#admin-material-list");
const materialsMessage = document.querySelector("#materials-message");
const materialsCount = document.querySelector("#materials-count");
const timetableList = document.querySelector("#admin-timetable-list");
const timetableMessage = document.querySelector("#timetable-message");
const timetableStatusFilter = document.querySelector("#timetable-status-filter");
const timetableSearch = document.querySelector("#timetable-search");
const timetableEditorDialog = document.querySelector("#timetable-editor-dialog");
const timetableEditorForm = document.querySelector("#timetable-editor-form");
const teacherProfileList = document.querySelector("#admin-teacher-profile-list");
const teacherProfilesMessage = document.querySelector("#teacher-profiles-message");
const attendanceList = document.querySelector("#admin-activity-list");
const attendanceMessage = document.querySelector("#attendance-message");
const attendanceCategoryFilter = document.querySelector("#attendance-category-filter");
const attendancePeriodFilter = document.querySelector("#attendance-period-filter");
const attendanceStatusFilter = document.querySelector("#attendance-status-filter");
const attendanceSearch = document.querySelector("#attendance-search");
const trashList = document.querySelector("#admin-trash-list");
const trashMessage = document.querySelector("#trash-message");
const pendingAccountList = document.querySelector("#pending-accounts-list");
const pendingAccountCount = document.querySelector("#pending-accounts-count");
const pendingAccountNavCount = document.querySelector("#pending-accounts-nav-count");
const paymentNavCount = document.querySelector("#payment-nav-count");
const pendingAccountMessage = document.querySelector("#pending-accounts-message");
const rejectAccountDialog = document.querySelector("#reject-account-dialog");
const rejectAccountForm = document.querySelector("#reject-account-form");
const rejectAccountReason = document.querySelector("#reject-account-reason");
const rejectAccountMessage = document.querySelector("#reject-account-message");
const overviewMessage = document.querySelector("#overview-message");
const overviewTasks = document.querySelector("#overview-tasks");
const overviewActivity = document.querySelector("#overview-activity");
const overviewStats = {
  students: document.querySelector("#overview-student-count"),
  pendingAccounts: document.querySelector("#overview-pending-account-count"),
  programmes: document.querySelector("#overview-programme-count"),
  teamMembers: document.querySelector("#overview-team-count"),
  pendingEnrollments: document.querySelector("#overview-enrollment-count"),
  activeLocations: document.querySelector("#overview-location-count"),
};
let adminOverviewRequest = 0;
const studentList = document.querySelector("#admin-student-list");
const studentsMessage = document.querySelector("#students-message");
const studentSearch = document.querySelector("#student-search");
const studentStatusFilter = document.querySelector("#student-status-filter");
const studentProgrammeFilter = document.querySelector("#student-programme-filter");
const memberSearch = document.querySelector("#member-search");
const memberRoleFilter = document.querySelector("#member-role-filter");
const memberSubsidiaryFilter = document.querySelector("#member-subsidiary-filter");
const studentModuleControls = document.querySelector("#student-module-controls");
const studentModuleList = document.querySelector("#admin-student-module-list");
const studentModuleMessage = document.querySelector("#student-module-message");
let locations = [];
let users = [];
let adminStudents = [];
let boardMembers = [];
let programmes = [];
let modulesByProgramme = new Map();
let activeCourseTeachers = [];
let programmeTeacherAssignments = [];
let courseSubmissions = [];
let hierarchyGroups = [];
let pendingAccounts = [];
let learningMaterials = [];
let adminTimetables = [];
let adminTeacherProfiles = [];
let paymentRecords = [];
const viewedPaymentEvidence = new Set();
let accountBeingRejected = null;
let finishRejectionReason = null;
let accountBeingPasswordUpdated = null;
let accountPasswordStatusTarget = accountMessage;
let credentialIsTemporary = true;
const roleOptions = [
  ["administrator", "Administrator"],
  ["executive", "Executive"],
  ["subsidiary_manager", "Subsidiary manager"],
  ["supervisor", "Supervisor"],
  ["operations", "Operations"],
  ["teacher", "Teacher"],
  ["learner", "Learner"],
];
const subsidiaryOptions = [
  ["central_administration", "Central administration"],
  ["best_rides", "BEST RIDES"],
  ["dehivas", "DEHIVAS"],
  ["tgf_supersales", "TGF Supersales"],
  ["tgfvp", "TGF Vocational Pathways"],
];
const adminThemeStorageKey = "tgf-admin-theme";

function applyAdminTheme(theme) {
  const isDark = theme === "dark";
  adminShell.classList.toggle("is-dark", isDark);
  adminThemeToggle.setAttribute("aria-pressed", String(isDark));
  adminThemeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  adminThemeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
}

let savedAdminTheme = "light";
try {
  savedAdminTheme = window.localStorage.getItem(adminThemeStorageKey) || "light";
} catch (error) {
  console.warn("The dashboard theme preference could not be loaded.", error);
}
applyAdminTheme(savedAdminTheme);

adminThemeToggle.addEventListener("click", () => {
  const nextTheme = adminShell.classList.contains("is-dark") ? "light" : "dark";
  applyAdminTheme(nextTheme);
  try {
    window.localStorage.setItem(adminThemeStorageKey, nextTheme);
  } catch (error) {
    console.warn("The dashboard theme preference could not be saved.", error);
  }
});

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboardPanel.hidden = true;
  signOutButton.hidden = true;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  signOutButton.hidden = false;
  setDashboardView("overview");
  window.dispatchEvent(new Event("tgf-account-authenticated"));
}

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function setDashboardView(viewName) {
  const panels = [...dashboardPanel.querySelectorAll("[data-admin-view-panel]")];
  const selectedPanel = panels.find((panel) => panel.dataset.adminViewPanel === viewName);
  if (!selectedPanel) return;

  for (const panel of panels) panel.hidden = panel !== selectedPanel;
  for (const item of adminSidebarNav.querySelectorAll("[data-admin-view]")) {
    const active = item.dataset.adminView === viewName;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  if (viewName === "messages") window.dispatchEvent(new Event("tgf-admin-messages-open"));
  if (viewName === "overview") void loadAdminOverview();
  if (viewName === "enrollments") void loadEnrollments();
  if (viewName === "payments") void loadPayments();
  if (viewName === "materials") void loadLearningMaterials();
  if (viewName === "timetables") void loadAdminTimetables();
  if (viewName === "teacher-profiles") void loadAdminTeacherProfiles();
  if (viewName === "attendance") void loadAdminActivity();
  if (viewName === "trash") void loadAdminTrash();
  if (viewName === "website") void loadFlyerHistory();
  if (viewName === "students") void loadAdminStudents();
  if (viewName === "pending-accounts") void loadPendingAccounts();
}

function renderAdminOverview(overview) {
  for (const [key, element] of Object.entries(overviewStats)) {
    element.textContent = String(overview.stats[key]);
  }
  const pendingPayments = overview.tasks.pendingPayments;
  paymentNavCount.textContent = String(pendingPayments);
  paymentNavCount.hidden = pendingPayments === 0;

  const taskItems = [
    {
      count: overview.tasks.pendingAccounts,
      title: "Account approvals",
      description: "Student registrations are waiting for review.",
      view: "pending-accounts",
      action: "Review accounts",
    },
    {
      count: overview.tasks.pendingEnrollments,
      title: "Enrollment requests",
      description: "Learners are waiting for enrollment decisions.",
      view: "enrollments",
      action: "Review enrollments",
    },
    {
      count: pendingPayments,
      title: "Payment evidence",
      description: "Student payment submissions are waiting for verification.",
      view: "payments",
      action: "Review payments",
    },
    {
      count: overview.tasks.incompleteProgrammes,
      title: "Programme setup",
      description: "Active programmes do not have any modules yet.",
      view: "learning",
      action: "Manage courses",
    },
    {
      count: overview.tasks.pendingTimetables,
      title: "Timetable approvals",
      description: "Teacher-submitted classes are waiting for review.",
      view: "timetables",
      action: "Review timetables",
    },
  ].filter((task) => task.count > 0);

  overviewTasks.replaceChildren();
  if (!taskItems.length) {
    overviewTasks.append(makeTag("p", "admin-empty", "You're all caught up. No pending administrative tasks."));
  } else {
    for (const task of taskItems) {
      const row = makeTag("article", "admin-task");
      const label = makeTag("div", "admin-task-label");
      label.append(makeTag("strong", "", task.title), makeTag("small", "", task.description));
      const count = makeTag("span", "admin-task-count", String(task.count));
      const action = makeTag("button", "", task.action);
      action.type = "button";
      action.addEventListener("click", () => setDashboardView(task.view));
      row.append(label, count, action);
      overviewTasks.append(row);
    }
  }

  overviewActivity.replaceChildren();
  if (!overview.activities.length) {
    overviewActivity.append(makeTag("p", "admin-empty", "No recent activity has been recorded."));
    return;
  }
  const dateFormatter = new Intl.DateTimeFormat("en-CM", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  for (const activity of overview.activities) {
    const row = makeTag("article", "admin-activity");
    const details = makeTag("div", "admin-activity-details");
    details.append(
      makeTag("strong", "", activity.label),
      makeTag("small", "", activity.subject),
    );
    const occurredAt = new Date(activity.occurredAt);
    const date = document.createElement("time");
    date.dateTime = occurredAt.toISOString();
    date.textContent = dateFormatter.format(occurredAt);
    row.append(details, date);
    overviewActivity.append(row);
  }
}

async function loadAdminOverview() {
  const requestId = ++adminOverviewRequest;
  const statsContainer = document.querySelector(".admin-overview-stats");
  statsContainer.setAttribute("aria-busy", "true");
  setMessage(overviewMessage, "Loading dashboard overview…");
  try {
    const overview = await requestJson("/api/admin/overview");
    if (requestId !== adminOverviewRequest) return;
    renderAdminOverview(overview);
    setMessage(overviewMessage, `Updated ${new Intl.DateTimeFormat("en-CM", {
      timeStyle: "short",
    }).format(new Date())}.`);
  } catch (error) {
    if (requestId !== adminOverviewRequest) return;
    for (const element of Object.values(overviewStats)) element.textContent = "—";
    overviewTasks.replaceChildren(makeTag("p", "admin-empty", "Overview data is unavailable."));
    overviewActivity.replaceChildren(makeTag("p", "admin-empty", "Recent activity is unavailable."));
    setMessage(overviewMessage, error.message, true);
  } finally {
    if (requestId === adminOverviewRequest) {
      statsContainer.setAttribute("aria-busy", "false");
    }
  }
}

function renderAdminActivity(items) {
  attendanceList.replaceChildren();
  if (!items.length) {
    attendanceList.append(makeTag("p", "admin-empty", "No matching user activity was found."));
    return;
  }
  const dateFormatter = new Intl.DateTimeFormat("en-CM", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  for (const item of items) {
    const row = makeTag("article", "admin-user");
    const details = makeTag("div", "admin-user-details");
    const lastActive = new Date(item.lastActive);
    const statusClass = item.status === "online" ? "visibility-badge" : item.status === "recently-active" ? "visibility-badge is-hidden" : "visibility-badge is-hidden";
    details.append(
      makeTag("h3", "", item.fullName || item.email),
      makeTag("p", "admin-location-subtitle", `${item.email} · ${item.accountCategory}`),
      makeTag("p", "admin-location-subtitle", `Last active ${dateFormatter.format(lastActive)}`),
      makeTag("span", statusClass, item.statusLabel),
    );
    row.append(details);
    attendanceList.append(row);
  }
}

async function loadAdminActivity() {
  setMessage(attendanceMessage, "Loading platform activity…");
  try {
    const params = new URLSearchParams({
      category: attendanceCategoryFilter.value,
      period: attendancePeriodFilter.value,
      status: attendanceStatusFilter.value,
      search: attendanceSearch.value.trim(),
    });
    const result = await requestJson(`/api/admin/activity?${params.toString()}`);
    renderAdminActivity(result.items);
    setMessage(attendanceMessage, "");
  } catch (error) {
    attendanceList.replaceChildren(makeTag("p", "admin-empty", "Platform activity is unavailable."));
    setMessage(attendanceMessage, error.message, true);
  }
}

async function loadAdminTrash() {
  setMessage(trashMessage, "Loading trash…");
  try {
    const result = await requestJson("/api/admin/trash");
    trashList.replaceChildren();
    if (!result.items.length) {
      trashList.append(makeTag("p", "admin-empty", "The trash is empty."));
      setMessage(trashMessage, "");
      return;
    }
    const dateFormatter = new Intl.DateTimeFormat("en-CM", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    for (const item of result.items) {
      const row = makeTag("article", "admin-user");
      const details = makeTag("div", "admin-user-details");
      details.append(
        makeTag("h3", "", item.title),
        makeTag("p", "admin-location-subtitle", `Type: ${item.kind}`),
        makeTag("p", "admin-location-subtitle", `Deleted: ${dateFormatter.format(new Date(item.deletedAt))}`),
      );
      if (item.entityType === "live-class") {
        details.append(makeTag(
          "p",
          "admin-location-subtitle",
          `Permanent deletion: ${dateFormatter.format(new Date(item.permanentDeleteAt))}`,
        ));
      } else {
        details.append(makeTag("p", "admin-location-subtitle", "This record can be restored from trash."));
      }
      const controls = makeTag("div", "admin-user-controls");
      const restore = makeTag("button", "small-action", "Restore");
      restore.type = "button";
      restore.addEventListener("click", async () => {
        try {
          const restoreUrl = item.entityType === "programme"
            ? `/api/admin/programmes/${encodeURIComponent(item.id)}/restore`
            : item.entityType === "weekly-timetable"
              ? `/api/admin/course-timetables/${encodeURIComponent(item.id)}/restore`
              : `/api/admin/trash/${encodeURIComponent(item.id)}/restore`;
          await requestJson(restoreUrl, { method: "POST" });
          if (item.entityType === "programme") await loadProgrammes();
          if (item.entityType === "weekly-timetable") {
            const refreshTimetables = document.querySelector('[data-collab-refresh="timetable"]');
            if (refreshTimetables) refreshTimetables.click();
          }
          await loadAdminTrash();
          setMessage(trashMessage, `${item.title} was restored.`);
        } catch (error) {
          setMessage(trashMessage, error.message, true);
        }
      });
      controls.append(restore);
      if (item.entityType === "live-class") {
        const purge = makeTag("button", "small-action small-action-danger", "Delete permanently");
        purge.type = "button";
        purge.addEventListener("click", async () => {
          if (!window.confirm(`Permanently delete "${item.title}" from trash? This cannot be undone.`)) return;
          try {
            await requestJson(`/api/admin/trash/${encodeURIComponent(item.id)}`, { method: "DELETE" });
            await loadAdminTrash();
            setMessage(trashMessage, `${item.title} was permanently deleted.`);
          } catch (error) {
            setMessage(trashMessage, error.message, true);
          }
        });
        controls.append(purge);
      }
      row.append(details, controls);
      trashList.append(row);
    }
    setMessage(trashMessage, "");
  } catch (error) {
    trashList.replaceChildren(makeTag("p", "admin-empty", "Trash is unavailable."));
    setMessage(trashMessage, error.message, true);
  }
}

function makeTag(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderLocations() {
  locationList.replaceChildren();
  locationCount.textContent = String(locations.length);

  if (!locations.length) {
    const empty = makeTag("p", "admin-empty", "No locations yet. Add the first location to get started.");
    locationList.append(empty);
    return;
  }
  renderLocationCards();
}

function renderBoardMembers() {
    boardList.replaceChildren();
    boardCount.textContent = String(boardMembers.length);
    if (!boardMembers.length) {
      boardList.append(makeTag("p", "admin-empty", "No board profiles have been added."));
      return;
    }
    for (const member of boardMembers) {
      const card = makeTag("article", "admin-user");
      const details = makeTag("div", "admin-user-details");
      const title = makeTag("h3", "", member.fullName);
      const description = makeTag(
        "p",
        "admin-location-subtitle",
        `${member.hierarchyGroup} · ${member.positionTitle}${member.isActive ? "" : " · Unpublished"}`,
      );
      details.append(title, description);
      const actions = makeTag("div", "admin-user-controls");
      const edit = makeTag("button", "small-action", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => openBoardEditor(member));
      const remove = makeTag("button", "small-action small-action-danger", "Delete");
      remove.type = "button";
      remove.addEventListener("click", () => void removeBoardMember(member));
      actions.append(edit, remove);
      card.append(details, actions);
      boardList.append(card);
    }
}

function renderCourses() {
    courseList.replaceChildren();
    if (!programmes.length) {
      courseList.append(makeTag("p", "admin-empty", "No programmes are available yet."));
      return;
    }
    for (const programme of programmes) {
      const section = makeTag("section", "course-admin-card");
      const heading = makeTag("div", "admin-panel-heading");
      const details = makeTag("div", "");
      details.append(
        makeTag("p", "micro-label", programme.isActive ? "Open for learner enrollment" : "Enrollment closed"),
        makeTag("h3", "", programme.title),
        makeTag("p", "admin-location-subtitle", programme.description || "No description yet."),
      );
      details.append(createProgrammePaymentPlanEditor(programme));
      const teacherAssignment = programmeTeacherAssignments.find((item) => item.programmeId === programme.id);
      const assignmentControls = makeTag("div", "admin-user-controls");
      const assignmentLabel = makeTag("label", "", "Assigned teacher");
      const teacherSelect = document.createElement("select");
      teacherSelect.setAttribute("aria-label", `Teacher assigned to ${programme.title}`);
      addSelectOptions(
        teacherSelect,
        [["", "No teacher assigned"], ...activeCourseTeachers.map((teacher) =>
          [teacher.id, `${teacher.name} · ${teacher.email}`])],
        teacherAssignment?.teacherId || "",
      );
      const canAssignTeacher = programme.isActive && activeCourseTeachers.length > 0;
      teacherSelect.disabled = !canAssignTeacher;
      assignmentLabel.append(teacherSelect);
      const saveAssignment = makeTag("button", "small-action", "Save assignment");
      saveAssignment.type = "button";
      saveAssignment.disabled = !canAssignTeacher;
      saveAssignment.addEventListener("click", () =>
        void saveProgrammeTeacher(programme, teacherSelect, saveAssignment));
      const assignmentHint = makeTag(
        "p",
        "admin-field-hint teacher-assignment-hint",
        !programme.isActive
          ? "Open enrollment before assigning a teacher to this course."
          : activeCourseTeachers.length === 0
            ? "No active teacher accounts are available. Create or activate one under Teacher profiles."
            : "Select an active teacher, then save. They can upload course material for Admin review.",
      );
      assignmentControls.append(assignmentLabel, saveAssignment, assignmentHint);
      details.append(assignmentControls);
      const toggle = makeTag(
        "button",
        "small-action",
        programme.isActive ? "Close enrollment" : "Open enrollment",
      );
      toggle.type = "button";
      toggle.addEventListener("click", () => void toggleProgramme(programme));
      const courseActions = makeTag("div", "admin-user-controls");
      const deleteCourse = makeTag("button", "small-action small-action-danger", "Move course to trash");
      deleteCourse.type = "button";
      deleteCourse.addEventListener("click", () => void trashProgramme(programme));
      courseActions.append(toggle, deleteCourse);
      heading.append(details, courseActions);
      const modules = makeTag("div", "module-admin-list");
      for (const module of modulesByProgramme.get(programme.id) || []) {
        const item = makeTag("article", "module-admin-card");
        const titleWrap = makeTag("div", "");
        titleWrap.append(
          makeTag("strong", "", `Module ${module.position}: ${module.title}`),
          makeTag("p", "admin-location-subtitle", module.description || "No summary."),
        );
        const release = makeTag(
          "button",
          module.isReleased ? "small-action" : "small-action small-action-danger",
          module.isReleased ? "Released" : "Locked · Release",
        );
        release.type = "button";
        release.setAttribute("aria-label", `${module.isReleased ? "Lock" : "Release"} ${module.title}`);
        release.addEventListener("click", () => void toggleModuleRelease(module));
        const actions = makeTag("div", "admin-user-controls");
        const edit = makeTag("button", "small-action", "Edit module");
        edit.type = "button";
        edit.addEventListener("click", () => openModuleEditor(programme, module));
        const editWeeks = makeTag("button", "small-action", "Edit 4-week plan");
        editWeeks.type = "button";
        const weeklyEditor = createModuleWeeksEditor(module);
        editWeeks.addEventListener("click", () => {
          weeklyEditor.hidden = !weeklyEditor.hidden;
          if (!weeklyEditor.hidden) weeklyEditor.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        actions.append(edit, release);
        actions.append(editWeeks);
        item.append(titleWrap, actions, weeklyEditor);
        modules.append(item);
      }
      if (!modules.childElementCount) {
        modules.append(makeTag("p", "admin-empty", "No modules yet. Add the first module below."));
      }
      section.append(heading, modules);
      courseList.append(section);
    }
}

function createProgrammePaymentPlanEditor(programme) {
  const editor = makeTag("details", "programme-payment-plan");
  editor.append(makeTag("summary", "", "Payment arrangement"));
  const totalLabel = makeTag("label", "", "Total course fee in XAF (registration included)");
  const totalFee = document.createElement("input");
  totalFee.type = "number";
  totalFee.min = "0";
  totalFee.max = "9007199254740991";
  totalFee.step = "1";
  totalFee.value = String(programme.totalFee || 0);
  totalFee.setAttribute("aria-label", `Total programme fee for ${programme.title}`);
  totalLabel.append(totalFee);
  const registrationLabel = makeTag("label", "", "Registration fee included in total (XAF)");
  const registrationFee = document.createElement("input");
  registrationFee.type = "number";
  registrationFee.min = "0";
  registrationFee.max = "9007199254740991";
  registrationFee.step = "1";
  registrationFee.value = String(programme.registrationFee || 0);
  registrationFee.setAttribute("aria-label", `Registration fee for ${programme.title}`);
  registrationLabel.append(registrationFee);

  const paymentChoiceLabel = makeTag("label", "", "How learners can pay the course balance");
  const paymentChoice = document.createElement("select");
  paymentChoice.setAttribute("aria-label", `Payment schedule for ${programme.title}`);
  const fullPayment = document.createElement("option");
  fullPayment.value = "full";
  fullPayment.textContent = "Pay the balance in full";
  const threePayments = document.createElement("option");
  threePayments.value = "three";
  threePayments.textContent = "Split the balance into 3 monthly installments";
  const currentInstallments = (programme.installments || []).map((item) => ({
    label: item.label,
    amount: Number(item.amount),
    dueDaysAfterEnrollment: item.dueDaysAfterEnrollment,
    paymentCategory: item.paymentCategory || "installment",
  }));
  const currentTotal = Number(programme.totalFee || 0);
  const currentRegistrationFee = Number(programme.registrationFee || 0);
  const currentRegistration = currentInstallments.find((item) => item.paymentCategory === "registration");
  const currentCoursePayments = currentInstallments.filter((item) => item.paymentCategory !== "registration");
  const registrationIsCurrent = currentRegistrationFee === 0
    ? !currentRegistration
    : currentRegistration?.amount === currentRegistrationFee;
  const isThreeMonthlyPayments = registrationIsCurrent &&
    currentCoursePayments.length === 3 &&
    currentCoursePayments.every((item, index) => item.dueDaysAfterEnrollment === index * 30) &&
    currentCoursePayments.reduce((sum, item) => sum + item.amount, 0) ===
      currentTotal - currentRegistrationFee;
  const isFullPayment = registrationIsCurrent &&
    (currentCoursePayments.length === 0
      ? currentTotal === currentRegistrationFee
      : currentCoursePayments.length === 1 &&
        currentCoursePayments[0].amount === currentTotal - currentRegistrationFee);
  const hasCustomSchedule = currentTotal > 0 && currentInstallments.length > 0 &&
    registrationIsCurrent && !isThreeMonthlyPayments && !isFullPayment;
  const useThreePaymentsByDefault = currentCoursePayments.length === 0;
  if (hasCustomSchedule) {
    const customChoice = document.createElement("option");
    customChoice.value = "custom";
    customChoice.textContent = "Keep current schedule";
    paymentChoice.append(customChoice);
  }
  paymentChoice.append(fullPayment, threePayments);
  paymentChoice.value = hasCustomSchedule
    ? "custom"
    : isThreeMonthlyPayments || useThreePaymentsByDefault
      ? "three"
      : "full";
  paymentChoiceLabel.append(paymentChoice);
  const scheduleHint = makeTag("p", "admin-field-hint", "");

  const instructionsLabel = makeTag("label", "", "Payment method or account details (optional)");
  const instructions = document.createElement("textarea");
  instructions.maxLength = 2000;
  instructions.rows = 2;
  instructions.value = programme.paymentInstructions || "";
  instructions.setAttribute("aria-label", `Payment method or account details for ${programme.title}`);
  const preview = makeTag("div", "programme-payment-preview");
  const save = makeTag("button", "small-action", "Save arrangement");
  save.type = "button";
  const createInstallments = () => {
    const total = Number(totalFee.value);
    const registration = Number(registrationFee.value);
    if (!Number.isSafeInteger(total) || total < 0 ||
        !Number.isSafeInteger(registration) || registration < 0 || registration > total) return null;
    const courseBalance = total - registration;
    if (total === 0) return [];
    if (paymentChoice.value === "custom") {
      if (total !== currentTotal || registration !== currentRegistrationFee) return null;
      return currentInstallments;
    }

    const schedule = registration > 0
      ? [{
          label: "Registration fee",
          amount: registration,
          dueDaysAfterEnrollment: 0,
          paymentCategory: "registration",
        }]
      : [];
    if (paymentChoice.value === "three") {
      if (courseBalance < 3) return null;
      const base = Math.floor(courseBalance / 3);
      const remainder = courseBalance % 3;
      return [
        ...schedule,
        ...[0, 1, 2].map((index) => ({
          label: ["First installment", "Second installment", "Third installment"][index],
          amount: base + (index < remainder ? 1 : 0),
          dueDaysAfterEnrollment: index * 30,
          paymentCategory: "installment",
        })),
      ];
    }
    return courseBalance > 0
      ? [
          ...schedule,
          {
            label: registration > 0 ? "Balance in full" : "Full course fee",
            amount: courseBalance,
            dueDaysAfterEnrollment: 0,
            paymentCategory: "installment",
          },
        ]
      : schedule;
  };
  const formatFee = (amount) =>
    `${amount.toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} XAF`;
  const renderPreview = () => {
    const enteredTotal = Number(totalFee.value);
    const enteredRegistration = Number(registrationFee.value);
    const validRegistration = Number.isSafeInteger(enteredRegistration) &&
      enteredRegistration >= 0 &&
      Number.isSafeInteger(enteredTotal) &&
      enteredTotal >= enteredRegistration;
    threePayments.disabled = !validRegistration || enteredTotal - enteredRegistration < 3;
    scheduleHint.textContent = !validRegistration
      ? "Enter a valid total fee and registration fee first."
      : enteredTotal - enteredRegistration < 3
        ? "The balance after registration must be at least XAF 3 to split into three installments."
        : "The three-installment option is available. The remaining balance will be split automatically.";
    const installments = createInstallments();
    preview.replaceChildren();
    if (!installments) {
      preview.append(makeTag(
        "p",
        "admin-message is-error",
        paymentChoice.value === "three"
          ? "The balance after registration must be at least 3 XAF to split into three installments."
          : "Choose a valid fee and schedule. Select a standard schedule to replace a changed custom plan.",
      ));
      save.disabled = true;
      return;
    }
    if (!installments.length) {
      preview.append(makeTag("p", "", "No payment is due for a free programme."));
    } else {
      const rows = makeTag("div", "programme-payment-preview-list");
      for (const item of installments) {
        const due = item.dueDaysAfterEnrollment === 0
          ? "At enrollment"
          : `${item.dueDaysAfterEnrollment} days after enrollment`;
        rows.append(makeTag("p", "", `${item.label}: ${formatFee(item.amount)} · ${due}`));
      }
      preview.append(rows);
      preview.append(makeTag(
        "p",
        "programme-payment-preview-total",
        `Total: ${formatFee(installments.reduce((sum, item) => sum + item.amount, 0))}`,
      ));
    }
    const validFee = Number.isSafeInteger(enteredTotal) &&
      totalFee.value.trim() !== "" &&
      validRegistration;
    const validSchedule = installments.reduce((sum, item) => sum + item.amount, 0) === enteredTotal;
    save.disabled = !validFee || !validSchedule;
    if (!validFee) {
      preview.append(makeTag(
        "p",
        "admin-message is-error",
        "The registration fee must be a whole amount that does not exceed the total course fee.",
      ));
    } else if (!validSchedule) {
      preview.append(makeTag("p", "admin-message is-error", "The payment schedule must add up to the total course fee."));
    }
  };
  totalFee.required = true;
  registrationFee.required = true;
  totalFee.addEventListener("input", renderPreview);
  registrationFee.addEventListener("input", renderPreview);
  paymentChoice.addEventListener("change", renderPreview);
  renderPreview();
  save.addEventListener("click", async () => {
    const installments = createInstallments();
    if (!installments || save.disabled) return;
    save.disabled = true;
    setMessage(courseMessage, `Saving payment arrangement for ${programme.title}…`);
    try {
      await requestJson(`/api/admin/programmes/${encodeURIComponent(programme.id)}/payment-plan`, {
        method: "PATCH",
        body: JSON.stringify({
          totalFee: Number(totalFee.value),
          registrationFee: Number(registrationFee.value),
          paymentInstructions: instructions.value,
          installments: installments.map((item) => ({
            label: item.label,
            paymentCategory: item.paymentCategory,
            amount: item.amount,
            dueDaysAfterEnrollment: item.dueDaysAfterEnrollment,
          })),
        }),
      });
      await loadProgrammes();
      setMessage(courseMessage, `Payment arrangement for ${programme.title} was saved.`);
    } catch (error) {
      setMessage(courseMessage, error.message, true);
      save.disabled = false;
    }
  });
  editor.append(
    totalLabel,
    registrationLabel,
    paymentChoiceLabel,
    scheduleHint,
    instructionsLabel,
    instructions,
    makeTag("p", "admin-field-hint", "Registration is included in the total. The remaining balance is paid in full or split into three monthly installments. Amounts are generated automatically."),
    preview,
    save,
  );
  return editor;
}

function renderLocationCards() {
  for (const location of locations) {
    const card = makeTag("article", "admin-location");
    const marker = makeTag("span", "admin-location-marker", location.city.slice(0, 1).toUpperCase());
    marker.setAttribute("aria-hidden", "true");

    const details = makeTag("div", "admin-location-details");
    const heading = makeTag("div", "admin-location-heading");
    heading.append(
      makeTag("h3", "", location.city),
      makeTag(
        "span",
        location.isActive ? "visibility-badge" : "visibility-badge is-hidden",
        location.isActive ? "Visible" : "Hidden",
      ),
    );
    details.append(heading);
    const subtitle = [location.region, location.address].filter(Boolean).join(" · ");
    if (subtitle) details.append(makeTag("p", "admin-location-subtitle", subtitle));
    if (location.description) details.append(makeTag("p", "admin-location-description", location.description));

    const actions = makeTag("div", "admin-location-actions");
    const edit = makeTag("button", "small-action", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openEditor(location));
    const remove = makeTag("button", "small-action small-action-danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => void deleteLocation(location));
    actions.append(edit, remove);
    card.append(marker, details, actions);
    locationList.append(card);
  }
}

function addSelectOptions(select, options, selected = "") {
  select.replaceChildren(
    ...options.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === selected;
      return option;
    }),
  );
}

function showCredential(name, password, email, role, mustChangePassword = true) {
  credentialName.textContent = `Login details for ${name}`;
  credentialEmail.textContent = email;
  credentialPassword.textContent = password;
  credentialIsTemporary = mustChangePassword;
  credentialPasswordHint.textContent = mustChangePassword
    ? "Share these login details securely. The temporary password is shown only once and must be changed at first sign-in."
    : "This password is active now. Share it securely with the account owner.";
  credentialLoginLink.href = role === "teacher" ? "/teacher" : role === "learner" ? "/student" : "/portal";
  credentialLoginLink.textContent = role === "teacher" ? "Teacher sign-in" : role === "learner" ? "Student sign-in" : "Team sign-in";
  setMessage(credentialMessage, "");
  document.querySelector("#copy-credential").textContent = "Copy login details";
  credentialCard.hidden = false;
  credentialCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderUsers() {
  userList.replaceChildren();
  const query = memberSearch.value.trim().toLowerCase();
  const roleFilter = memberRoleFilter.value;
  const subsidiaryFilter = memberSubsidiaryFilter.value;
  const filteredUsers = users.filter((user) =>
    (!query || `${user.fullName} ${user.email}`.toLowerCase().includes(query)) &&
    (roleFilter === "all" || user.role === roleFilter) &&
    (subsidiaryFilter === "all" || user.subsidiary === subsidiaryFilter),
  );
  userCount.textContent = filteredUsers.length === users.length
    ? String(users.length)
    : `${filteredUsers.length} / ${users.length}`;
  if (!filteredUsers.length) {
    userList.append(makeTag(
      "p",
      "admin-empty",
      users.length ? "No members match these filters." : "No team accounts have been created.",
    ));
    return;
  }

  for (const user of filteredUsers) {
    const card = makeTag("article", "admin-user");
    const details = makeTag("div", "admin-user-details");
    details.append(
      makeTag("h3", "", user.fullName),
      makeTag("p", "admin-location-subtitle", `${user.email} · ${user.role.replaceAll("_", " ")}`),
      makeTag("p", "admin-location-subtitle", `Registered ${new Intl.DateTimeFormat("en-CM", { dateStyle: "medium" }).format(new Date(user.createdAt))}`),
    );
    const controls = makeTag("div", "admin-user-controls");
    const role = document.createElement("select");
    role.setAttribute("aria-label", `Role for ${user.fullName}`);
    addSelectOptions(role, roleOptions, user.role);
    const subsidiary = document.createElement("select");
    subsidiary.setAttribute("aria-label", `Company for ${user.fullName}`);
    addSelectOptions(subsidiary, subsidiaryOptions, user.subsidiary);
    const status = makeTag(
      "span",
      user.isFrozen ? "visibility-badge is-hidden" : "visibility-badge",
      user.isFrozen ? "Suspended" : "Active",
    );
    const save = makeTag("button", "small-action", "Save role");
    save.type = "button";
    save.addEventListener("click", () => void saveUser(user, role.value, subsidiary.value));
    const freeze = makeTag(
      "button",
      "small-action",
      user.isFrozen ? "Unsuspend" : "Suspend",
    );
    freeze.type = "button";
    freeze.addEventListener("click", () =>
      void saveUser(user, role.value, subsidiary.value, !user.isFrozen),
    );
    const reset = makeTag("button", "small-action", "Reset password");
    reset.type = "button";
    reset.addEventListener("click", () => openAccountPasswordDialog(user, accountMessage));
    const support = makeTag("button", "small-action", "Access support");
    support.type = "button";
    support.addEventListener("click", async () => {
      try {
        const result = await requestJson(`/api/admin/users/${encodeURIComponent(user.id)}/support-access`, {
          method: "POST",
          body: JSON.stringify({ reason: "Administrator support review" }),
        });
        setMessage(accountMessage, `${result.recordedTarget} support access was approved and logged for ${result.actor}.`);
      } catch (error) {
        setMessage(accountMessage, error.message, true);
      }
    });
    const remove = makeTag("button", "small-action small-action-danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => void deleteUser(user));
    controls.append(role, subsidiary, status, save, freeze, reset, support, remove);
    card.append(details, controls);
    userList.append(card);
  }
}

async function loadLocations() {
  setMessage(dashboardMessage, "Loading locations…");
  try {
    const result = await requestJson("/api/admin/locations");
    locations = result;
    renderLocations();
    setMessage(dashboardMessage, "");
  } catch (error) {
    setMessage(dashboardMessage, error.message, true);
    if (error.message.includes("sign in again")) showLogin();
  }
}

async function loadBoardMembers() {
  try {
    const result = await requestJson("/api/admin/board-members");
    boardMembers = result.members;
    hierarchyGroups = result.groups;
    addSelectOptions(document.querySelector("#board-member-group"), hierarchyGroups.map((group) => [group, group]));
    renderBoardMembers();
  } catch (error) {
    setMessage(boardMessage, error.message, true);
  }
}

async function loadProgrammes() {
  try {
    const [programmeList, teacherAssignments] = await Promise.all([
      requestJson("/api/admin/programmes"),
      requestJson("/api/admin/programme-teachers"),
    ]);
    programmes = programmeList;
    activeCourseTeachers = teacherAssignments.teachers;
    programmeTeacherAssignments = teacherAssignments.assignments;
    modulesByProgramme = new Map();
    await Promise.all(programmes.map(async (programme) => {
      modulesByProgramme.set(
        programme.id,
        await requestJson(`/api/admin/programmes/${encodeURIComponent(programme.id)}/modules`),
      );
    }));
    const moduleProgrammeSelect = document.querySelector("#module-programme");
    moduleProgrammeSelect.disabled = false;
    addSelectOptions(
      moduleProgrammeSelect,
      programmes.map((programme) => [programme.id, programme.title]),
      programmes[0]?.id || "",
    );
    renderCourses();
    void loadCourseSubmissions();
    return true;
  } catch (error) {
    setMessage(courseMessage, error.message, true);
    return false;
  }
}

async function saveProgrammeTeacher(programme, select, button) {
  const teacherId = select.value;
  button.disabled = true;
  try {
    await requestJson("/api/admin/programme-teachers", {
      method: "PUT",
      body: JSON.stringify({ programmeId: programme.id, teacherId }),
    });
    if (!(await loadProgrammes())) {
      setMessage(courseMessage, "The save request succeeded, but the assignment list could not be refreshed. Reload the page to verify it.", true);
      button.disabled = false;
      return;
    }
    const savedAssignment = programmeTeacherAssignments.find((item) => item.programmeId === programme.id);
    if ((savedAssignment?.teacherId || "") !== teacherId) {
      setMessage(courseMessage, "The assignment did not appear after refreshing. It was not saved; please try again.", true);
      return;
    }
    setMessage(courseMessage, teacherId
      ? `Teacher assigned to ${programme.title}.`
      : `Teacher assignment removed from ${programme.title}.`);
  } catch (error) {
    setMessage(courseMessage, error.message, true);
    button.disabled = false;
  }
}

function renderCurriculumDraft(curriculum) {
  const preview = makeTag("details", "course-curriculum-preview");
  preview.append(makeTag("summary", "", "Review generated modules and weekly lessons"));
  if (curriculum?.sourceExtractionFallback) {
    preview.append(makeTag(
      "p",
      "material-ai-message is-wide is-warning",
      "The platform could not extract text from this source. It created a five-day page schedule where page information was available. Review every daily assignment against the original before approving.",
    ));
  }
  for (const [moduleIndex, module] of (curriculum?.modules || []).entries()) {
    const moduleDetails = makeTag("details", "course-draft-module");
    moduleDetails.append(makeTag("summary", "", `Module ${moduleIndex + 1}: ${module.title}`));
    moduleDetails.append(makeTag("p", "admin-location-subtitle", module.description));
    for (const [weekIndex, week] of (module.weeks || []).entries()) {
      const weekDetails = makeTag("details", "course-draft-week");
      weekDetails.append(makeTag("summary", "", `Week ${weekIndex + 1}: ${week.title}`));
      weekDetails.append(
        makeTag("p", "", week.description),
        makeTag("p", "admin-location-subtitle", `Objectives: ${week.learningObjectives}`),
      );
      if (Array.isArray(week.days) && week.days.length === 5) {
        const days = makeTag("div", "module-week-days");
        for (const day of week.days) {
          const pageLabel = day.sourcePageStart
            ? day.sourcePageStart === day.sourcePageEnd
              ? `Page ${day.sourcePageStart}`
              : `Pages ${day.sourcePageStart}-${day.sourcePageEnd}`
            : "Source pages to verify";
          const dayCard = makeTag("section", "module-week-day");
          dayCard.append(
            makeTag("h5", "", `${day.title} · ${pageLabel}`),
            makeTag("div", "module-week-day-content", day.lessonContent),
          );
          days.append(dayCard);
        }
        weekDetails.append(days);
      } else {
        weekDetails.append(makeTag("div", "module-week-lesson", week.lessonContent));
      }
      moduleDetails.append(weekDetails);
    }
    moduleDetails.append(makeTag("h4", "", "Capstone prompt"));
    moduleDetails.append(makeTag("p", "", module.capstonePrompt));
    preview.append(moduleDetails);
  }
  return preview;
}

function renderCourseSubmissions() {
  courseSubmissionList.replaceChildren();
  if (!courseSubmissions.length) {
    courseSubmissionList.append(makeTag("p", "admin-empty", "No course documents are waiting for curriculum review."));
    return;
  }
  for (const submission of courseSubmissions) {
    const card = makeTag("article", "admin-user course-submission-card");
    const details = makeTag("div", "admin-user-details");
    details.append(
      makeTag("h3", "", submission.title),
      makeTag("p", "admin-location-subtitle",
        `${submission.teacherName} · ${submission.programmeTitle} · ${submission.originalFilename}`),
      makeTag("span", submission.reviewStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
        submission.reviewStatus),
    );
    const fileLink = document.createElement("a");
    fileLink.className = "small-action";
    fileLink.href = submission.fileUrl;
    fileLink.target = "_blank";
    fileLink.rel = "noopener noreferrer";
    fileLink.textContent = "View private source document";
    details.append(fileLink);
    if (submission.adminFeedback) details.append(makeTag("p", "admin-location-subtitle", submission.adminFeedback));
    if (submission.generationError) details.append(makeTag("p", "admin-message is-error", submission.generationError));
    card.append(details);

    if (submission.curriculumDraft) card.append(renderCurriculumDraft(submission.curriculumDraft));
    if (["pending", "drafted"].includes(submission.reviewStatus)) {
      const controls = makeTag("div", "admin-user-controls");
      const durationLabel = makeTag("label", "", "Course duration");
      const duration = document.createElement("select");
      duration.setAttribute("aria-label", `Module count for ${submission.title}`);
      addSelectOptions(duration, [
        ["", "Select modules"],
        ...Array.from({ length: 8 }, (_, index) => [String(index + 1), `${index + 1} ${index === 0 ? "module" : "modules"}`]),
      ], String(submission.moduleCount || ""));
      duration.required = true;
      durationLabel.append(duration);
      const generate = makeTag("button", "small-action", submission.reviewStatus === "drafted"
        ? "Regenerate AI draft"
        : "Generate AI draft");
      generate.type = "button";
      generate.addEventListener("click", () =>
        void generateCourseDraft(submission, duration, generate));
      controls.append(durationLabel, generate);
      if (submission.reviewStatus === "drafted") {
        const approve = makeTag("button", "small-action", "Approve and publish");
        approve.type = "button";
        approve.addEventListener("click", () =>
          void reviewCourseSubmission(submission, "approve", approve));
        controls.append(approve);
      }
      const reject = makeTag("button", "small-action small-action-danger", "Reject");
      reject.type = "button";
      reject.addEventListener("click", () =>
        void reviewCourseSubmission(submission, "reject", reject));
      controls.append(reject);
      card.append(controls);
    } else if (submission.reviewStatus === "generating") {
      card.append(makeTag("p", "admin-message", "AI is generating this curriculum draft…"));
    }
    courseSubmissionList.append(card);
  }
}

async function loadCourseSubmissions() {
  setMessage(courseSubmissionsMessage, "Loading course submissions…");
  try {
    courseSubmissions = await requestJson("/api/admin/course-submissions");
    renderCourseSubmissions();
    setMessage(courseSubmissionsMessage, "");
  } catch (error) {
    setMessage(courseSubmissionsMessage, error.message, true);
    courseSubmissionList.replaceChildren(makeTag("p", "admin-empty", "Course submissions are unavailable."));
  }
}

async function generateCourseDraft(submission, duration, button) {
  const moduleCount = Number(duration.value);
  if (!Number.isInteger(moduleCount) || moduleCount < 1 || moduleCount > 8) {
    setMessage(courseSubmissionsMessage, "Choose a course duration between 1 and 8 modules.", true);
    duration.focus();
    return;
  }
  button.disabled = true;
  setMessage(courseSubmissionsMessage, "Generating student-ready weekly lessons from the uploaded course document…");
  try {
    await requestJson(`/api/admin/course-submissions/${encodeURIComponent(submission.id)}/generate`, {
      method: "POST",
      body: JSON.stringify({ moduleCount }),
    });
    await loadCourseSubmissions();
    setMessage(courseSubmissionsMessage, "Draft generated. Review the weekly lessons and capstones before approving.");
  } catch (error) {
    setMessage(courseSubmissionsMessage, error.message, true);
    button.disabled = false;
  }
}

async function reviewCourseSubmission(submission, action, button) {
  let feedback = "";
  if (action === "reject") {
    feedback = window.prompt(`Why is "${submission.title}" being rejected?`);
    if (feedback === null) return;
    feedback = feedback.trim();
    if (feedback.length < 5 || feedback.length > 2000) {
      setMessage(courseSubmissionsMessage, "Enter rejection feedback between 5 and 2000 characters.", true);
      return;
    }
  } else if (!window.confirm(
    `Approve this ${submission.moduleCount}-module curriculum and release its first module to enrolled learners?`,
  )) {
    return;
  }
  button.disabled = true;
  try {
    await requestJson(`/api/admin/course-submissions/${encodeURIComponent(submission.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, feedback }),
    });
    await Promise.all([loadCourseSubmissions(), loadProgrammes()]);
    setMessage(courseSubmissionsMessage, action === "approve"
      ? "Curriculum approved. The first module is now available to enrolled learners."
      : "Course submission rejected. The teacher can review your feedback.");
  } catch (error) {
    setMessage(courseSubmissionsMessage, error.message, true);
    button.disabled = false;
  }
}

function openBoardEditor(member = null) {
  setMessage(boardFormMessage, "");
  boardForm.reset();
  document.querySelector("#board-form-heading").textContent =
    member ? `Edit ${member.fullName}` : "Add a board member";
  document.querySelector("#board-member-id").value = member?.id || "";
  document.querySelector("#board-member-name").value = member?.fullName || "";
  document.querySelector("#board-member-title").value = member?.positionTitle || "";
  addSelectOptions(
    document.querySelector("#board-member-group"),
    hierarchyGroups.map((group) => [group, group]),
    member?.hierarchyGroup || hierarchyGroups[0],
  );
  document.querySelector("#board-member-bio").value = member?.biography || "";
  document.querySelector("#board-member-order").value = String(member?.sortOrder ?? boardMembers.length + 1);
  document.querySelector("#board-member-active").checked = member?.isActive ?? true;
  boardPhotoUrl.value = member?.photoUrl || "";
  boardPhoto.value = "";
  boardPhotoPreview.src = boardPhotoUrl.value;
  boardPhotoPreviewWrap.hidden = !boardPhotoUrl.value;
  boardForm.hidden = false;
  boardForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeBoardMember(member) {
  if (!window.confirm(`Delete ${member.fullName}'s public profile?`)) return;
  try {
    await requestJson(`/api/admin/board-members/${encodeURIComponent(member.id)}`, { method: "DELETE" });
    boardMembers = boardMembers.filter((entry) => entry.id !== member.id);
    renderBoardMembers();
    setMessage(boardMessage, `${member.fullName}'s profile was deleted.`);
  } catch (error) {
    setMessage(boardMessage, error.message, true);
  }
}

async function toggleProgramme(programme) {
  try {
    await requestJson(`/api/admin/programmes/${encodeURIComponent(programme.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...programme, isActive: !programme.isActive }),
    });
    await loadProgrammes();
    setMessage(courseMessage, `${programme.title} enrollment was updated.`);
  } catch (error) {
    setMessage(courseMessage, error.message, true);
  }
}

async function trashProgramme(programme) {
  if (!window.confirm(
    `Move "${programme.title}" and its generated course content to recoverable trash? ` +
    "Learners will lose access until the course is restored.",
  )) return;
  try {
    await requestJson(`/api/admin/programmes/${encodeURIComponent(programme.id)}`, {
      method: "DELETE",
    });
    await loadProgrammes();
    await loadAdminTrash();
    setMessage(courseMessage, `${programme.title} was moved to recoverable trash.`);
  } catch (error) {
    setMessage(courseMessage, error.message, true);
  }
}

function createModuleWeeksEditor(module) {
  const form = makeTag("form", "admin-form weekly-plan-editor");
  form.hidden = true;
  form.append(makeTag("h4", "", "Four-week learning plan"));
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const weekNumber = index + 1;
    const savedWeek = module.weeks?.find((week) => week.weekNumber === weekNumber);
    const fieldset = document.createElement("fieldset");
    fieldset.className = "weekly-plan-block";
    const legend = document.createElement("legend");
    legend.textContent = `Week ${weekNumber}`;
    fieldset.append(legend);

    const title = document.createElement("input");
    title.type = "text";
    title.maxLength = 120;
    title.required = true;
    title.value = savedWeek?.title || `Week ${weekNumber}`;
    title.setAttribute("aria-label", `Week ${weekNumber} title`);
    const description = document.createElement("textarea");
    description.maxLength = 2000;
    description.rows = 2;
    description.value = savedWeek?.description || "";
    description.setAttribute("aria-label", `Week ${weekNumber} learning activities`);
    const objectives = document.createElement("textarea");
    objectives.maxLength = 2000;
    objectives.rows = 2;
    objectives.value = savedWeek?.learningObjectives || "";
    objectives.setAttribute("aria-label", `Week ${weekNumber} learning objectives`);
    const releaseDate = document.createElement("input");
    releaseDate.type = "date";
    releaseDate.value = savedWeek?.availableAt ? savedWeek.availableAt.slice(0, 10) : "";
    releaseDate.setAttribute("aria-label", `Week ${weekNumber} release date`);

    for (const [labelText, control] of [
      ["Title", title],
      ["Learning activities", description],
      ["Learning objectives", objectives],
      ["Release date (optional)", releaseDate],
    ]) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.append(control);
      fieldset.append(label);
    }
    return { fieldset, title, description, objectives, releaseDate };
  });
  form.append(...weeks.map((week) => week.fieldset));
  const message = makeTag("p", "admin-message");
  message.setAttribute("role", "status");
  const save = makeTag("button", "button button-orange", "Save weekly plan");
  save.type = "submit";
  form.append(message, save);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    save.disabled = true;
    try {
      await requestJson(`/api/admin/modules/${encodeURIComponent(module.id)}/weeks`, {
        method: "PUT",
        body: JSON.stringify({
          weeks: weeks.map((week) => ({
            title: week.title.value,
            description: week.description.value,
            learningObjectives: week.objectives.value,
            availableAt: week.releaseDate.value,
          })),
        }),
      });
      await loadProgrammes();
      setMessage(courseMessage, `${module.title} weekly plan saved.`);
    } catch (error) {
      setMessage(message, error.message, true);
    } finally {
      save.disabled = false;
    }
  });
  return form;
}

async function toggleModuleRelease(module) {
  try {
    await requestJson(`/api/admin/modules/${encodeURIComponent(module.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: module.title,
        description: module.description,
        lessonContent: module.lessonContent,
        meetingUrl: module.meetingUrl,
        position: module.position,
        isReleased: !module.isReleased,
      }),
    });
    await loadProgrammes();
    setMessage(courseMessage, `${module.title} is now ${module.isReleased ? "locked" : "released"}.`);
  } catch (error) {
    setMessage(courseMessage, error.message, true);
  }
}

function resetModuleEditor() {
  moduleForm.reset();
  document.querySelector("#module-id").value = "";
  document.querySelector("#module-position").value = "1";
  document.querySelector("#module-programme").disabled = false;
  document.querySelector("#module-form-heading").textContent = "Add a module";
  document.querySelector("#save-module").firstChild.textContent = "Add module ";
  document.querySelector("#cancel-module-edit").hidden = true;
  document.querySelector("#module-released").checked = false;
  addSelectOptions(
    document.querySelector("#module-programme"),
    programmes.map((programme) => [programme.id, programme.title]),
    programmes[0]?.id || "",
  );
}

function openModuleEditor(programme, module) {
  document.querySelector("#module-id").value = module.id;
  document.querySelector("#module-programme").replaceChildren(
    ...programmes.map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.title;
      option.selected = item.id === programme.id;
      return option;
    }),
  );
  document.querySelector("#module-programme").disabled = true;
  document.querySelector("#module-title").value = module.title;
  document.querySelector("#module-description").value = module.description;
  document.querySelector("#module-content").value = module.lessonContent;
  document.querySelector("#module-meeting-url").value = module.meetingUrl;
  document.querySelector("#module-position").value = String(module.position);
  document.querySelector("#module-released").checked = module.isReleased;
  document.querySelector("#module-form-heading").textContent = `Edit ${module.title}`;
  document.querySelector("#save-module").firstChild.textContent = "Save module ";
  document.querySelector("#cancel-module-edit").hidden = false;
  setMessage(moduleFormMessage, "");
  moduleForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function loadUsers() {
  try {
    users = await requestJson("/api/admin/users");
    renderUsers();
  } catch (error) {
    setMessage(accountMessage, error.message, true);
  }
}

function renderAdminStudents() {
  studentList.replaceChildren();
  const inClassCount = adminStudents.filter((student) => student.isInClass).length;
  document.querySelector("#student-total-count").textContent = String(adminStudents.length);
  document.querySelector("#student-in-class-count").textContent = String(inClassCount);

  const query = studentSearch.value.trim().toLowerCase();
  const status = studentStatusFilter.value;
  const programme = studentProgrammeFilter.value;
  const filtered = adminStudents.filter((student) => {
    const matchesText = !query || `${student.fullName} ${student.email}`.toLowerCase().includes(query);
    const matchesProgramme = programme === "all" ||
      student.programmeTitles.includes(programme);
    const matchesStatus = status === "all" ||
      (status === "in-class" && student.isInClass) ||
      (status === "active" && !student.isFrozen) ||
      (status === "suspended" && student.isFrozen);
    return matchesText && matchesProgramme && matchesStatus;
  });

  if (!filtered.length) {
    studentList.append(makeTag("p", "admin-empty", adminStudents.length
      ? "No students match these filters."
      : "No student accounts have been registered yet."));
    return;
  }

  for (const student of filtered) {
    const row = makeTag("article", "student-roster-row");
    const identity = makeTag("div", "student-roster-identity");
    const registered = new Intl.DateTimeFormat("en-CM", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(student.registeredAt));
    identity.append(
      makeTag("h3", "", student.fullName),
      makeTag("p", "admin-location-subtitle", student.email),
      makeTag("p", "admin-location-subtitle", `Registered ${registered}`),
      makeTag(
        "p",
        "admin-location-subtitle",
        `Programme groups: ${student.programmeTitles.length ? student.programmeTitles.join(" · ") : "Not enrolled"}`,
      ),
    );

    const statusWrap = makeTag("div", "student-roster-status");
    statusWrap.append(makeTag(
      "span",
      student.isFrozen ? "visibility-badge is-hidden" : "visibility-badge",
      student.isFrozen ? "Suspended" : "Active",
    ));
    statusWrap.append(makeTag(
      "span",
      student.isInClass ? "class-presence-badge is-present" : "class-presence-badge",
      student.isInClass ? `In class now · ${student.activeClassTitle}` : "Not in class",
    ));

    const actions = makeTag("div", "student-roster-actions");
    const modules = makeTag("button", "small-action", "Manage modules");
    modules.type = "button";
    modules.addEventListener("click", () => void openStudentModuleControls(student));
    const suspension = makeTag(
      "button",
      student.isFrozen ? "small-action" : "small-action small-action-danger",
      student.isFrozen ? "Unsuspend" : "Suspend",
    );
    suspension.type = "button";
    suspension.addEventListener("click", () => void toggleStudentSuspension(student, suspension));
    actions.append(modules, suspension);
    row.append(identity, statusWrap, actions);
    studentList.append(row);
  }
}

async function loadAdminStudents() {
  try {
    const result = await requestJson("/api/admin/students");
    const changed = result.students.length !== adminStudents.length || result.students.some((student, index) => {
      const current = adminStudents[index];
      return !current || current.id !== student.id || current.fullName !== student.fullName ||
        current.email !== student.email || current.isFrozen !== student.isFrozen ||
        current.registeredAt !== student.registeredAt || current.isInClass !== student.isInClass ||
        current.activeClassTitle !== student.activeClassTitle ||
        JSON.stringify(current.programmeTitles) !== JSON.stringify(student.programmeTitles);
    });
    adminStudents = result.students;
    const selectedProgramme = studentProgrammeFilter.value;
    const programmeNames = [...new Set(adminStudents.flatMap((student) => student.programmeTitles))].sort();
    addSelectOptions(
      studentProgrammeFilter,
      [["all", "All programmes"], ...programmeNames.map((name) => [name, name])],
      programmeNames.includes(selectedProgramme) ? selectedProgramme : "all",
    );
    document.querySelector("#student-recent-count").textContent = String(result.recentRegistrationCount);
    if (changed) renderAdminStudents();
    setMessage(studentsMessage, "");
  } catch (error) {
    setMessage(studentsMessage, error.message, true);
  }
}

async function toggleStudentSuspension(student, button) {
  button.disabled = true;
  setMessage(studentsMessage, `${student.isFrozen ? "Restoring" : "Suspending"} ${student.fullName}…`);
  try {
    const result = await requestJson(`/api/admin/users/${encodeURIComponent(student.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        fullName: student.fullName,
        email: student.email,
        role: "learner",
        subsidiary: "tgfvp",
        isFrozen: !student.isFrozen,
      }),
    });
    users = users.map((user) => user.id === student.id ? result.user : user);
    adminStudents = adminStudents.map((item) => item.id === student.id
      ? { ...item, isFrozen: result.user.isFrozen }
      : item);
    renderAdminStudents();
    renderUsers();
    setMessage(studentsMessage, `${student.fullName} is ${result.user.isFrozen ? "suspended" : "active"}.`);
  } catch (error) {
    setMessage(studentsMessage, error.message, true);
    button.disabled = false;
  }
}

async function openStudentModuleControls(student) {
  studentModuleControls.hidden = false;
  studentModuleControls.dataset.studentId = student.id;
  document.querySelector("#student-module-heading").textContent = `Module access · ${student.fullName}`;
  studentModuleList.replaceChildren();
  setMessage(studentModuleMessage, "Loading this student's approved modules…");
  try {
    const programmes = await requestJson(`/api/admin/students/${encodeURIComponent(student.id)}/modules`);
    const modules = programmes.flatMap((programme) => programme.modules.map((module) => ({
      ...module,
      programmeTitle: programme.title,
    })));
    if (!modules.length) {
      studentModuleList.append(makeTag("p", "admin-empty", "This student has no approved programme modules yet."));
      setMessage(studentModuleMessage, "");
      studentModuleControls.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    for (const module of modules) {
      const row = makeTag("article", "student-module-row");
      const details = makeTag("div", "student-module-details");
      details.append(
        makeTag("h4", "", module.title),
        makeTag("p", "admin-location-subtitle", `${module.programmeTitle} · Module ${module.position}${module.completed ? " · Completed" : ""}`),
      );
      const access = document.createElement("select");
      access.setAttribute("aria-label", `Access for ${module.title}`);
      addSelectOptions(access, [
        ["default", "Default progression"],
        ["unlocked", "Unlock for student"],
        ["blocked", "Block for student"],
      ], module.accessState);
      access.addEventListener("change", () => void saveStudentModuleAccess(student, module, access));
      row.append(details, access);
      studentModuleList.append(row);
    }
    setMessage(studentModuleMessage, "");
    studentModuleControls.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    setMessage(studentModuleMessage, error.message, true);
  }
}

async function saveStudentModuleAccess(student, module, select) {
  select.disabled = true;
  try {
    await requestJson(
      `/api/admin/students/${encodeURIComponent(student.id)}/modules/${encodeURIComponent(module.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ accessState: select.value }),
      },
    );
    setMessage(studentModuleMessage, `${module.title} access saved for ${student.fullName}.`);
  } catch (error) {
    setMessage(studentModuleMessage, error.message, true);
  } finally {
    select.disabled = false;
  }
}

async function saveUser(
  user,
  role,
  subsidiary,
  isFrozen = user.isFrozen,
  resetPassword = false,
  messageTarget = accountMessage,
  password = null,
) {
  setMessage(messageTarget, `Updating ${user.fullName}…`);
  try {
    const result = await requestJson(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        fullName: user.fullName,
        email: user.email,
        role,
        subsidiary,
        isFrozen,
        resetPassword,
        ...(password ? { password } : {}),
      }),
    });
    users = users.map((item) => (item.id === user.id ? result.user : item));
    renderUsers();
    if (result.temporaryPassword) {
      showCredential(result.user.fullName, result.temporaryPassword, result.user.email, result.user.role);
      setMessage(messageTarget, "Password reset. The temporary password was shown once.");
    } else if (password) {
      showCredential(result.user.fullName, password, result.user.email, result.user.role, false);
      setMessage(messageTarget, "Password updated and active immediately.");
    } else {
      setMessage(messageTarget, `${result.user.fullName} has been updated.`);
    }
    return true;
  } catch (error) {
    setMessage(messageTarget, error.message, true);
    return false;
  }
}

async function deleteUser(user) {
  if (!window.confirm(`Permanently delete ${user.fullName}'s account? This cannot be undone.`)) return;
  try {
    await requestJson(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
    users = users.filter((item) => item.id !== user.id);
    renderUsers();
    setMessage(accountMessage, `${user.fullName}'s account has been deleted.`);
  } catch (error) {
    setMessage(accountMessage, error.message, true);
  }
}

async function loadSettings() {
  try {
    const settings = await requestJson("/api/admin/site-settings");
    settingsForm.elements.resumptionDate.value = settings.resumptionDate;
    settingsForm.elements.resumptionLabel.value = settings.resumptionLabel;
    settingsForm.elements.accentColor.value = settings.accentColor;
    flyerImageUrl.value = settings.flyerImageUrl;
    flyerDateField.value = settings.flyerDateText;
    flyerPreviewDate.textContent = settings.flyerDateText;
    flyerPreview.src = settings.flyerImageUrl;
    flyerPreviewWrap.hidden = !settings.flyerImageUrl;
  } catch (error) {
    setMessage(settingsMessage, error.message, true);
  }
}

async function loadFlyerHistory() {
  setMessage(flyerHistoryMessage, "Loading previous flyer versions…");
  flyerHistoryList.replaceChildren();
  try {
    const history = await requestJson("/api/admin/flyer-history");
    if (!history.length) {
      flyerHistoryList.append(makeTag("p", "admin-empty", "No previous flyer versions have been saved."));
    }
    for (const version of history) {
      const card = makeTag("article", "admin-user");
      const details = makeTag("div", "admin-user-details");
      details.append(
        makeTag("h3", "", version.flyerDateText || "Flyer version"),
        makeTag("p", "admin-location-subtitle", `Saved ${new Intl.DateTimeFormat("en-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.savedAt))} by ${version.changedBy}`),
      );
      const restore = makeTag("button", "small-action", "Load for restore");
      restore.type = "button";
      restore.addEventListener("click", () => {
        flyerImageUrl.value = version.imageUrl;
        flyerDateField.value = version.flyerDateText;
        flyerPreviewDate.textContent = version.flyerDateText;
        flyerPreview.src = version.imageUrl;
        flyerPreviewWrap.hidden = !version.imageUrl;
        setMessage(settingsMessage, "Previous flyer values loaded. Save website settings to publish them.");
        settingsForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      card.append(details, restore);
      flyerHistoryList.append(card);
    }
    setMessage(flyerHistoryMessage, "");
  } catch (error) {
    setMessage(flyerHistoryMessage, error.message, true);
    flyerHistoryList.replaceChildren(makeTag("p", "admin-empty", "Flyer version history is unavailable."));
  }
}

function renderEnrollmentRequests(requests) {
  enrollmentList.replaceChildren();
  enrollmentCount.textContent = String(requests.length);
  enrollmentNavCount.textContent = String(requests.length);
  enrollmentNavCount.hidden = requests.length === 0;
  if (!requests.length) {
    enrollmentList.append(makeTag("p", "admin-empty", "There are no enrollment requests waiting for review."));
    return;
  }
  for (const request of requests) {
    const row = makeTag("article", "admin-user enrollment-request");
    const details = makeTag("div", "admin-user-details");
    details.append(
      makeTag("h3", "", request.fullName),
      makeTag("p", "admin-location-subtitle", `${request.email} · ${request.programmeTitle}`),
      makeTag("p", "admin-location-subtitle", `Requested ${new Intl.DateTimeFormat("en-CM", { dateStyle: "medium" }).format(new Date(request.requestedAt))}`),
      makeTag(
        "p",
        "admin-location-subtitle",
        Number(request.registrationFee) > 0
          ? `Registration fee: XAF ${new Intl.NumberFormat("en-CM").format(request.registrationFee)}`
          : "No registration fee",
      ),
    );
    const actions = makeTag("div", "admin-user-controls");
    if (request.paymentProofUrl) {
      const paymentRecord = { ...request, enrollmentId: request.id };
      const payment = {
        id: request.paymentId,
        proofUrl: request.paymentProofUrl,
        originalFilename: request.paymentFilename,
        status: request.paymentStatus,
      };
      addPaymentEvidenceLink(details, paymentRecord, payment, actions);
    }
    const paymentStatus = makeTag(
      "span",
      request.paymentStatus === "approved" || Number(request.registrationFee) === 0
        ? "visibility-badge"
        : "visibility-badge is-hidden",
      request.paymentStatus
        ? `Payment ${request.paymentStatus}`
        : Number(request.registrationFee) === 0
          ? "Payment not required"
          : "Payment evidence missing",
    );
    actions.append(paymentStatus);
    if (request.paymentId && request.paymentStatus === "pending") {
      if (viewedPaymentEvidence.has(request.paymentId)) {
        appendPaymentReviewButtons(actions, { ...request, enrollmentId: request.id }, {
          id: request.paymentId,
        });
      }
    }
    const approveEnrollmentButton = makeTag("button", "small-action enrollment-approve", "Approve enrollment");
    approveEnrollmentButton.type = "button";
    const canApproveEnrollment = Number(request.registrationFee) === 0 || request.paymentStatus === "approved";
    approveEnrollmentButton.disabled = !canApproveEnrollment;
    approveEnrollmentButton.title = canApproveEnrollment
      ? ""
      : "Verify the payment before approving enrollment.";
    approveEnrollmentButton.addEventListener("click", () =>
      void reviewEnrollment(request, "approve", approveEnrollmentButton));
    const rejectEnrollmentButton = makeTag("button", "small-action small-action-danger", "Reject enrollment");
    rejectEnrollmentButton.type = "button";
    rejectEnrollmentButton.addEventListener("click", () =>
      void reviewEnrollment(request, "reject", rejectEnrollmentButton));
    const historyButton = makeTag("button", "small-action", "View history");
    historyButton.type = "button";
    const historyPanel = makeTag("div", "enrollment-history");
    historyPanel.hidden = true;
    historyButton.addEventListener("click", () => {
      historyPanel.hidden = !historyPanel.hidden;
      if (!historyPanel.hidden) void loadEnrollmentHistory(request, historyPanel);
    });
    actions.append(approveEnrollmentButton, rejectEnrollmentButton, historyButton);
    row.append(details, actions, historyPanel);
    enrollmentList.append(row);
  }
}

function renderPaymentManagement() {
  const search = paymentSearch.value.trim().toLowerCase();
  const status = paymentStatusFilter.value;
  const receiptStatus = paymentReceiptStatusFilter.value;
  const receipts = paymentRecords.flatMap((record) =>
    record.payments
      .filter((payment) => payment.paymentType !== "manual")
      .map((payment) => ({ record, payment })),
  ).sort((left, right) =>
    new Date(right.payment.submittedAt).getTime() - new Date(left.payment.submittedAt).getTime(),
  );
  const matchingReceipts = receipts.filter(({ record, payment }) =>
    (receiptStatus === "all" || payment.status === receiptStatus) &&
    `${record.fullName} ${record.email} ${record.programmeTitle} ${payment.originalFilename} ${payment.paymentLabel}`
      .toLowerCase()
      .includes(search),
  );
  paymentReceiptCount.textContent = String(receipts.length);
  paymentReceiptList.replaceChildren();
  if (!matchingReceipts.length) {
    paymentReceiptList.append(makeTag(
      "p",
      "admin-empty",
      receipts.length
        ? "No student receipts match these filters."
        : "No student receipts have been submitted yet. Admin-recorded payments do not include uploaded receipt files.",
    ));
  } else {
    const money = (amount) => `XAF ${new Intl.NumberFormat("en-CM").format(amount)}`;
    for (const { record, payment } of matchingReceipts) {
      const card = makeTag("article", "payment-receipt-card");
      const details = makeTag("div", "payment-receipt-main");
      const date = new Intl.DateTimeFormat("en-CM", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(payment.submittedAt));
      const paymentLabel = payment.paymentLabel ||
        (payment.paymentType === "activation" ? "Registration fee" : "Programme installment");
      details.append(
        makeTag("h3", "", record.fullName),
        makeTag("p", "admin-location-subtitle", `${record.email} · ${record.programmeTitle}`),
        makeTag(
          "p",
          "admin-location-subtitle",
          `${paymentLabel} · ${money(payment.amount)} · ${paymentStatusLabel(payment.status)} · ${date}`,
        ),
      );
      const actions = makeTag("div", "admin-user-controls");
      const statusTag = makeTag(
        "span",
        payment.status === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
        paymentStatusLabel(payment.status),
      );
      actions.append(statusTag);
      addPaymentEvidenceLink(details, record, payment, actions);
      if (payment.status === "pending" && viewedPaymentEvidence.has(payment.id)) {
        appendPaymentReviewButtons(actions, record, payment);
      }
      card.append(details, actions);
      paymentReceiptList.append(card);
    }
  }

  const records = paymentRecords.filter((record) =>
    (status === "all" || record.paymentStatus === status) &&
    `${record.fullName} ${record.email} ${record.programmeTitle}`.toLowerCase().includes(search),
  );
  paymentRecordCount.textContent = String(records.length);
  paymentsList.replaceChildren();
  if (!records.length) {
    paymentsList.append(makeTag("p", "admin-empty", paymentRecords.length
      ? "No payment records match these filters."
      : "There are no programme enrollments with payment records yet."));
    return;
  }
  const money = (amount) => `XAF ${new Intl.NumberFormat("en-CM").format(amount)}`;
  for (const record of records) {
    const card = makeTag("article", "payment-management-record");
    const heading = makeTag("div", "payment-record-heading");
    const identity = makeTag("div", "payment-record-identity");
    identity.append(
      makeTag("h3", "", record.fullName),
      makeTag("p", "", record.email),
      makeTag("span", "", `${record.programmeTitle} · Enrollment ${record.enrollmentStatus}`),
    );
    const statusTag = makeTag(
      "span",
      `payment-status-badge is-${record.paymentStatus}`,
      record.paymentStatus === "full"
        ? "Fully paid"
        : record.paymentStatus === "pending"
          ? "Pending verification"
          : "Owing",
    );
    heading.append(identity, statusTag);
    card.append(heading);

    const metrics = makeTag("div", "payment-record-metrics");
    for (const [label, amount] of [
      ["Total fee", record.totalFee],
      ["Paid", record.amountPaid],
      ["Awaiting review", record.amountPending],
      ["Balance due", record.outstandingBalance],
    ]) {
      const metric = makeTag("div", "payment-record-metric");
      metric.append(
        makeTag("span", "", label),
        makeTag("strong", "", money(amount)),
      );
      metrics.append(metric);
    }
    card.append(metrics);
    if (record.totalFee > 0) {
      const progress = document.createElement("progress");
      progress.className = "payment-record-progress";
      progress.max = record.totalFee;
      progress.value = Math.min(record.amountPaid, record.totalFee);
      progress.setAttribute(
        "aria-label",
        `${money(record.amountPaid)} paid of ${money(record.totalFee)}`,
      );
      card.append(progress);
    }

    let paidToAllocate = Math.max(Number(record.amountPaid) || 0, 0);
    const paymentOptions = record.installments.map((installment, index) => {
      const amount = Number(installment.amount);
      const paidToward = Math.min(paidToAllocate, amount);
      paidToAllocate -= paidToward;
      return {
        ...installment,
        sequenceNumber: Number(installment.sequenceNumber) || index + 1,
        amountDue: Math.max(amount - paidToward, 0),
      };
    });
    const nextPayment = paymentOptions.find((installment) => installment.amountDue > 0);
    const paymentPending = Number(record.amountPending) > 0;
    const detailSections = makeTag("div", "payment-record-details");
    if (paymentOptions.length) {
      const schedule = makeTag("div", "payment-schedule");
      schedule.append(makeTag(
        "p",
        "payment-schedule-note",
        `Registration fee included in total: ${money(record.registrationFee)}.`,
      ));
      if (record.paymentInstructions) {
        schedule.append(makeTag("p", "payment-schedule-note", record.paymentInstructions));
      }
      for (const installment of paymentOptions) {
        const statusText = installment.amountDue === 0
          ? "Paid"
          : paymentPending
            ? "Awaiting verification"
            : installment.sequenceNumber === nextPayment?.sequenceNumber
              ? `Next · ${money(installment.amountDue)}`
              : "Due after previous payment";
        const row = makeTag("div", "payment-schedule-row");
        const label = makeTag("div", "payment-schedule-label");
        label.append(
          makeTag("strong", "", installment.label),
          makeTag(
            "small",
            "",
            `Due ${new Intl.DateTimeFormat("en-CM", { dateStyle: "medium" }).format(new Date(installment.dueAt))}`,
          ),
        );
        row.append(
          label,
          makeTag("span", "", money(installment.amount)),
          makeTag("span", `payment-installment-status${installment.amountDue === 0 ? " is-paid" : ""}`, statusText),
        );
        schedule.append(row);
      }
      const scheduleSection = makeTag("details", "payment-record-section");
      scheduleSection.append(
        makeTag("summary", "", "Payment schedule"),
        schedule,
      );
      detailSections.append(scheduleSection);
    }

    const paymentHistory = makeTag("div", "payment-history");
    for (const payment of record.payments) {
      const entry = makeTag("div", "payment-history-entry");
      const date = new Intl.DateTimeFormat("en-CM", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(payment.submittedAt));
      const manualPayment = payment.paymentType === "manual";
      const methodLabels = {
        cash: "Cash",
        mobile_money: "Mobile Money",
        bank_transfer: "Bank transfer",
        other: "Other",
      };
      const scheduledPayment = record.installments.find(
        (installment) => installment.sequenceNumber === payment.installmentSequenceNumber,
      );
      const paymentLabel = payment.paymentLabel || (payment.paymentCategory === "registration"
        ? "Registration fee"
        : scheduledPayment?.label ||
          (payment.installmentSequenceNumber ? `Installment ${payment.installmentSequenceNumber}` : "Programme payment"));
      const paymentDetails = makeTag("div", "payment-history-details");
      paymentDetails.append(
        makeTag("strong", "", paymentLabel),
        makeTag(
          "span",
          "",
          `${money(payment.amount)} · ${paymentStatusLabel(payment.status)} · ${date}` +
            (payment.recordedBy ? ` · recorded by ${payment.recordedBy}` : ""),
        ),
      );
      if (!manualPayment && payment.rejectionReason) {
        paymentDetails.append(makeTag("small", "payment-rejection-reason", payment.rejectionReason));
      }
      if (manualPayment) {
        paymentDetails.append(makeTag(
          "small",
          "",
          `Admin-recorded · ${methodLabels[payment.paymentMethod] || "Other"}` +
            (payment.rejectionReason ? ` · Reference: ${payment.rejectionReason}` : ""),
        ));
      }
      entry.append(paymentDetails);
      if (!manualPayment) {
        const actions = makeTag("div", "admin-user-controls");
        addPaymentEvidenceLink(entry, record, payment, actions);
        if (payment.status === "pending" && viewedPaymentEvidence.has(payment.id)) {
          appendPaymentReviewButtons(actions, record, payment);
        }
        entry.append(actions);
      }
      paymentHistory.append(entry);
    }
    if (!record.payments.length) {
      paymentHistory.append(makeTag("p", "admin-empty", "No payment activity has been recorded."));
    }
    const historySection = makeTag("details", "payment-record-section");
    historySection.append(
      makeTag("summary", "", `Payment history · ${record.payments.length}`),
      paymentHistory,
    );
    detailSections.append(historySection);

    if (record.enrollmentStatus === "approved" && record.outstandingBalance > 0) {
      const recordSection = makeTag("details", "payment-record-section");
      const recordForm = makeTag("form", "record-payment-form");
      recordSection.append(makeTag("summary", "", "Record a payment"));
      if (paymentOptions.length && nextPayment) {
        const categoryLabel = makeTag("label", "", "Payment received for");
        const categoryInput = document.createElement("select");
        categoryInput.name = "sequenceNumber";
        categoryInput.required = true;
        const amountInput = document.createElement("input");
        amountInput.type = "number";
        amountInput.name = "amount";
        amountInput.readOnly = true;
        amountInput.required = true;
        amountInput.setAttribute("aria-label", "Scheduled amount to record in XAF");
        for (const installment of paymentOptions) {
          const option = makeTag(
            "option",
            "",
            `${installment.label} · ${money(installment.amountDue || installment.amount)}` +
              (installment.amountDue === 0 ? " · Paid" : ""),
          );
          option.value = String(installment.sequenceNumber);
          option.dataset.amount = String(installment.amountDue);
          option.dataset.paymentCategory = installment.paymentCategory || "installment";
          option.disabled = paymentPending ||
            installment.amountDue === 0 ||
            installment.sequenceNumber !== nextPayment.sequenceNumber;
          categoryInput.append(option);
        }
        categoryInput.value = String(nextPayment.sequenceNumber);
        categoryLabel.append(categoryInput);
        const amountLabel = makeTag("label", "", "Scheduled amount (XAF)");
        amountInput.value = String(nextPayment.amountDue);
        amountLabel.append(amountInput);
        categoryInput.addEventListener("change", () => {
          const selected = categoryInput.selectedOptions[0];
          amountInput.value = selected?.dataset.amount || "";
        });
        recordForm.append(categoryLabel, amountLabel);
        if (paymentPending) {
          recordForm.append(makeTag(
            "p",
            "admin-field-hint",
            "Review the pending student receipt before recording another payment.",
          ));
          categoryInput.disabled = true;
        }
        const methodLabel = makeTag("label", "", "Payment method");
        const methodInput = document.createElement("select");
        methodInput.name = "paymentMethod";
        methodInput.required = true;
        for (const [value, label] of [
          ["cash", "Cash"],
          ["mobile_money", "Mobile Money"],
          ["bank_transfer", "Bank transfer"],
          ["other", "Other"],
        ]) {
          const option = makeTag("option", "", label);
          option.value = value;
          methodInput.append(option);
        }
        methodLabel.append(methodInput);
        const referenceLabel = makeTag("label", "", "Reference or note (optional)");
        const referenceInput = document.createElement("input");
        referenceInput.type = "text";
        referenceInput.name = "reference";
        referenceInput.maxLength = 250;
        referenceLabel.append(referenceInput);
        const submit = makeTag("button", "small-action", "Record payment");
        submit.type = "submit";
        submit.disabled = paymentPending;
        recordForm.append(methodLabel, referenceLabel, submit);
        recordForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          submit.disabled = true;
          try {
            const selected = categoryInput.selectedOptions[0];
            await requestJson(`/api/admin/payments/${encodeURIComponent(record.enrollmentId)}/record`, {
              method: "POST",
              body: JSON.stringify({
                amount: Number(amountInput.value),
                paymentCategory: selected?.dataset.paymentCategory,
                sequenceNumber: Number(categoryInput.value),
                paymentMethod: methodInput.value,
                reference: referenceInput.value.trim(),
              }),
            });
            await loadPayments();
            setMessage(paymentsMessage, `${money(Number(amountInput.value))} recorded for ${record.fullName}.`);
          } catch (error) {
            setMessage(paymentsMessage, error.message, true);
            submit.disabled = false;
          }
        });
      } else {
        recordForm.append(makeTag(
          "p",
          "admin-message is-error",
          "There is no unpaid payment schedule. Save a payment arrangement before recording this balance.",
        ));
      }
      recordSection.append(recordForm);
      detailSections.append(recordSection);
    }
    card.append(detailSections);
    paymentsList.append(card);
  }
}

function addPaymentEvidenceLink(parent, record, payment, actions) {
  const evidence = document.createElement("a");
  evidence.className = "small-action";
  evidence.href = payment.proofUrl;
  evidence.target = "_blank";
  evidence.rel = "noopener noreferrer";
  evidence.textContent = `View receipt · ${payment.originalFilename}`;
  if (payment.status === "pending") {
    evidence.addEventListener("click", () => {
      viewedPaymentEvidence.add(payment.id);
      appendPaymentReviewButtons(actions, record, payment);
    });
  }
  parent.append(evidence);
}

function paymentStatusLabel(status) {
  if (status === "pending") return "Awaiting review";
  if (status === "rejected") return "Declined";
  return "Approved";
}

function appendPaymentReviewButtons(parent, record, payment) {
  if (parent.dataset.paymentReviewId === payment.id) return;
  parent.dataset.paymentReviewId = payment.id;
  const request = {
    fullName: record.fullName,
    paymentId: payment.id,
    enrollmentId: record.enrollmentId,
  };
  const approve = makeTag("button", "small-action", "Approve payment");
  approve.type = "button";
  approve.addEventListener("click", () => void reviewPayment(request, "approve", approve));
  const decline = makeTag("button", "small-action small-action-danger", "Decline payment");
  decline.type = "button";
  decline.addEventListener("click", () => void reviewPayment(request, "reject", decline));
  parent.append(approve, decline);
}

async function loadPayments() {
  setMessage(paymentsMessage, "Loading payment records…");
  paymentsList.replaceChildren();
  try {
    const result = await requestJson("/api/admin/payments");
    paymentRecords = result.items;
    document.querySelector("#payment-full-count").textContent = String(result.summary.fullPayment);
    document.querySelector("#payment-owing-count").textContent = String(result.summary.owing);
    document.querySelector("#payment-pending-count").textContent = String(result.summary.pendingVerification);
    paymentNavCount.textContent = String(result.summary.pendingVerification);
    paymentNavCount.hidden = result.summary.pendingVerification === 0;
    document.querySelector("#payment-outstanding-total").textContent =
      `XAF ${new Intl.NumberFormat("en-CM").format(result.summary.outstandingBalance)}`;
    renderPaymentManagement();
    setMessage(paymentsMessage, "");
  } catch (error) {
    setMessage(paymentsMessage, error.message, true);
    paymentsList.replaceChildren(makeTag("p", "admin-empty", "Payment records could not be loaded."));
  }
}

async function loadEnrollmentHistory(request, panel) {
  panel.replaceChildren(makeTag("p", "admin-empty", "Loading enrollment history…"));
  try {
    const history = await requestJson(`/api/admin/enrollments/${encodeURIComponent(request.id)}/history`);
    panel.replaceChildren();
    if (!history.length) {
      panel.append(makeTag("p", "admin-empty", "No payment or enrollment review history is recorded."));
      return;
    }
    for (const event of history) {
      const occurredAt = new Intl.DateTimeFormat("en-CM", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(event.occurredAt));
      panel.append(makeTag(
        "p",
        "admin-location-subtitle",
        `${event.eventType}: ${event.status} · ${occurredAt} · ${event.actorName}${event.reason ? ` · ${event.reason}` : ""}`,
      ));
    }
  } catch (error) {
    panel.replaceChildren(makeTag("p", "admin-message is-error", error.message));
  }
}

async function loadEnrollments() {
  try {
    const requests = await requestJson("/api/admin/enrollments");
    renderEnrollmentRequests(requests);
    setMessage(enrollmentMessage, "");
  } catch (error) {
    setMessage(enrollmentMessage, error.message, true);
  }
}

function renderLearningMaterials() {
  materialsList.replaceChildren();
  materialsCount.textContent = String(learningMaterials.filter((material) =>
    material.reviewStatus === "pending").length);
  if (!learningMaterials.length) {
    materialsList.append(makeTag("p", "admin-empty", "No learning materials have been submitted."));
    return;
  }
  for (const material of learningMaterials) {
    const card = makeTag("article", "material-review-card");
    const header = makeTag("header", "material-review-header");
    const identity = makeTag("div", "material-review-identity");
    identity.append(
      makeTag("p", "micro-label", "Teacher submission"),
      makeTag("h3", "material-review-title", material.title),
    );
    const status = makeTag(
      "span",
      material.reviewStatus === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
      material.reviewStatus,
    );
    header.append(identity, status);

    const submittedAt = new Date(material.submittedAt);
    const submittedLabel = Number.isNaN(submittedAt.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-CM", { dateStyle: "medium", timeStyle: "short" }).format(submittedAt);
    const meta = makeTag("div", "material-review-meta");
    const addMeta = (label, value) => {
      const item = makeTag("div", "material-review-meta-item");
      item.append(makeTag("span", "", label), makeTag("strong", "", value));
      meta.append(item);
    };
    addMeta("Submitted by", material.uploaderName);
    addMeta("Course", material.programmeTitle);
    addMeta("Placement", material.moduleTitle || "Awaiting module assignment");
    addMeta("Received", submittedLabel);

    const filePanel = makeTag("div", "material-review-file");
    const fileInfo = makeTag("div", "material-review-file-info");
    const extension = material.originalFilename.includes(".")
      ? material.originalFilename.split(".").pop().toUpperCase()
      : "FILE";
    fileInfo.append(
      makeTag("span", "material-review-file-type", extension),
      makeTag("strong", "material-review-filename", material.originalFilename),
      makeTag("small", "", "Private file · opens securely in TGF"),
    );
    const fileLink = document.createElement("a");
    fileLink.className = "button button-quiet material-review-file-link";
    fileLink.href = `/api/private-files/${encodeURIComponent(material.id)}`;
    fileLink.target = "_blank";
    fileLink.rel = "noopener noreferrer";
    fileLink.textContent = "View file ↗";
    filePanel.append(fileInfo, fileLink);
    card.append(header, meta, filePanel);
    if (material.description) {
      card.append(makeTag("p", "material-review-description", material.description));
    }
    if (material.adminFeedback) {
      card.append(makeTag("p", "material-review-feedback", material.adminFeedback));
    }

    if (material.reviewStatus === "pending") {
      const form = makeTag("form", "admin-form material-review-form");
      const assignment = {};
      const field = (labelText, control, isWide = false) => {
        const label = makeTag(
          "label",
          `material-review-field${isWide ? " is-wide" : ""}`,
          labelText,
        );
        label.append(control);
        form.append(label);
        return control;
      };
      const aiSupported = /\.(pdf|docx)$/i.test(material.originalFilename);
      const courseModules = modulesByProgramme.get(material.programmeId) || [];
      if (aiSupported) {
        const formHeading = makeTag("div", "material-review-form-heading");
        formHeading.append(
          makeTag("h4", "", "Generate course modules from this document"),
          makeTag("p", "", "Choose 1 to 8 modules. Each module has exactly four ordered weeks, with five study days in every week and a capstone at the end of Week 4. The curriculum stays private until you approve it."),
        );
        form.append(formHeading);

        const moduleCount = document.createElement("select");
        moduleCount.setAttribute("aria-label", `Number of modules for ${material.title}`);
        addSelectOptions(moduleCount, Array.from({ length: 8 }, (_, index) => [
          String(index + 1),
          `${index + 1} ${index === 0 ? "module" : "modules"}`,
        ]), String(material.aiModuleCount || 1));
        field("Number of modules", moduleCount);

        const hasDraft = material.aiPlanStatus === "drafted" &&
          material.aiCurriculumDraft?.modules?.length === material.aiModuleCount;
        if (hasDraft) {
          form.append(renderCurriculumDraft(material.aiCurriculumDraft));
        } else if (material.aiPlanStatus === "generating") {
          form.append(makeTag("p", "material-ai-message is-wide", "The platform is arranging the source into modules and four-week plans. This document will stay private until approval."));
        } else if (material.aiPlanStatus === "failed" && material.aiGenerationError) {
          form.append(makeTag("p", "material-ai-message is-wide is-error", material.aiGenerationError));
        }

        const actions = makeTag("div", "admin-user-controls material-review-actions");
        const generate = makeTag("button", "button button-quiet", hasDraft
          ? "Regenerate curriculum"
          : "Generate modules and weeks");
        generate.type = "button";
        generate.disabled = material.aiPlanStatus === "generating";
        generate.addEventListener("click", () =>
          void generateLearningMaterialCurriculum(material, moduleCount, generate));
        actions.append(generate);
        if (hasDraft) {
          const approve = makeTag("button", "button button-orange", `Approve and publish ${material.aiModuleCount} modules`);
          approve.type = "button";
          approve.addEventListener("click", () =>
            void reviewLearningMaterial(material, "approve", approve));
          actions.append(approve);
        }
        const reject = makeTag("button", "small-action small-action-danger", "Reject");
        reject.type = "button";
        reject.addEventListener("click", () =>
          void reviewLearningMaterial(material, "reject", reject));
        actions.append(reject);
        form.append(actions);
      } else {
        const formHeading = makeTag("div", "material-review-form-heading");
        formHeading.append(
          makeTag("h4", "", "Review and place in the course"),
          makeTag("p", "", courseModules.length
            ? "Choose where this resource belongs before approving it."
            : "Approve the course curriculum first to make module placement available."),
        );
        form.append(formHeading);
        const moduleSelect = document.createElement("select");
        const modulePlaceholder = document.createElement("option");
        modulePlaceholder.value = "";
        modulePlaceholder.textContent = courseModules.length
          ? "Choose a course module"
          : "Generate and approve course modules first";
        modulePlaceholder.disabled = true;
        modulePlaceholder.selected = !material.moduleId;
        moduleSelect.append(modulePlaceholder);
        for (const module of courseModules) {
          const option = document.createElement("option");
          option.value = module.id;
          option.textContent = `Module ${module.position}: ${module.title}`;
          moduleSelect.append(option);
        }
        if (material.moduleId && courseModules.some((module) => module.id === material.moduleId)) {
          moduleSelect.value = material.moduleId;
        }
        moduleSelect.required = true;
        assignment.module = field("Course module", moduleSelect);
        const week = document.createElement("select");
        addSelectOptions(week, [[1, "Week 1"], [2, "Week 2"], [3, "Week 3"], [4, "Week 4"]]);
        assignment.week = field("Weekly block", week);
        assignment.section = field("Section title", Object.assign(document.createElement("input"), {
          type: "text",
          maxLength: 120,
          required: true,
          value: material.title,
        }), true);
        assignment.start = field("Page start (optional)", Object.assign(document.createElement("input"), {
          type: "number",
          min: 1,
          step: 1,
        }));
        assignment.end = field("Page end (optional)", Object.assign(document.createElement("input"), {
          type: "number",
          min: 1,
          step: 1,
        }));
        assignment.objectives = field("Learner objectives (optional)", Object.assign(document.createElement("textarea"), {
          maxLength: 2000,
          rows: 2,
        }), true);
        assignment.category = field("Classification", document.createElement("select"));
        addSelectOptions(assignment.category, [
          ["reading", "Reading"],
          ["notes", "Notes"],
          ["worksheet", "Worksheet"],
          ["reference", "Reference"],
          ["assessment", "Assessment"],
        ]);
        const approve = makeTag("button", "button button-orange", courseModules.length
          ? "Approve and assign"
          : "Modules not ready");
        approve.type = "button";
        approve.disabled = courseModules.length === 0;
        approve.addEventListener("click", () =>
          void reviewLearningMaterial(material, "approve", approve, assignment));
        const reject = makeTag("button", "small-action small-action-danger", "Reject");
        reject.type = "button";
        reject.addEventListener("click", () =>
          void reviewLearningMaterial(material, "reject", reject));
        actions.append(approve, reject);
        form.append(actions);
      }
      card.append(form);
    }
    materialsList.append(card);
  }
}

async function loadLearningMaterials() {
  setMessage(materialsMessage, "Loading teaching material submissions…");
  try {
    learningMaterials = await requestJson("/api/admin/materials");
    const pendingProgrammeIds = [...new Set(learningMaterials
      .filter((material) => material.reviewStatus === "pending")
      .map((material) => material.programmeId))];
    await Promise.all(pendingProgrammeIds.map(async (programmeId) => {
      modulesByProgramme.set(
        programmeId,
        await requestJson(`/api/admin/programmes/${encodeURIComponent(programmeId)}/modules`),
      );
    }));
    renderLearningMaterials();
    setMessage(materialsMessage, "");
  } catch (error) {
    setMessage(materialsMessage, error.message, true);
    materialsList.replaceChildren(makeTag("p", "admin-empty", "Learning material submissions are unavailable."));
  }
}

async function generateLearningMaterialCurriculum(material, moduleCountSelect, button) {
  const moduleCount = Number(moduleCountSelect.value);
  if (!Number.isInteger(moduleCount) || moduleCount < 1 || moduleCount > 8) {
    setMessage(materialsMessage, "Choose between 1 and 8 modules before generating the curriculum.", true);
    return;
  }
  button.disabled = true;
  button.textContent = "Arranging modules and weeks…";
  setMessage(materialsMessage, `Arranging "${material.title}" into ${moduleCount} modules with four weeks each…`);
  try {
    await requestJson(`/api/admin/materials/${encodeURIComponent(material.id)}/generate-curriculum`, {
      method: "POST",
      body: JSON.stringify({ moduleCount }),
    });
    await loadLearningMaterials();
    setMessage(materialsMessage, "Curriculum arranged into modules, four weeks per module, and five study days per week. Review it before approving.");
  } catch (error) {
    await loadLearningMaterials();
    setMessage(materialsMessage, error.message, true);
    button.disabled = false;
  }
}

async function reviewLearningMaterial(material, action, button, assignment) {
  let feedback = "";
  if (action === "reject") {
    feedback = window.prompt(`Why is "${material.title}" being rejected?`);
    if (feedback === null) return;
    feedback = feedback.trim();
    if (feedback.length < 5) {
      setMessage(materialsMessage, "Enter rejection feedback of at least 5 characters.", true);
      return;
    }
  }
  if (action === "approve" && assignment && !assignment.section.form.reportValidity()) {
    return;
  }
  const publishesCurriculum = action === "approve" &&
    /\.(pdf|docx)$/i.test(material.originalFilename);
  if (publishesCurriculum && !window.confirm(
    `Approve ${material.aiModuleCount} modules with four weeks and five study days per week, and replace this course's current curriculum? Each module capstone is at the end of Week 4. Students will begin with the first module.`,
  )) {
    return;
  }
  button.disabled = true;
  try {
    await requestJson(`/api/admin/materials/${encodeURIComponent(material.id)}/review`, {
      method: "POST",
      body: JSON.stringify({
        action,
        feedback,
        ...(action === "approve" && assignment ? {
          assignment: {
            moduleId: assignment.module.value,
            weekNumber: Number(assignment.week.value),
            sectionTitle: assignment.section.value,
            pageStart: assignment.start.value,
            pageEnd: assignment.end.value,
            learningObjectives: assignment.objectives.value,
            category: assignment.category.value,
          },
        } : {}),
      }),
    });
    if (publishesCurriculum) {
      await Promise.all([loadLearningMaterials(), loadProgrammes()]);
      setMessage(materialsMessage, `Curriculum approved. ${material.aiModuleCount} modules with four weeks and five study days per week are now available in the course dashboards.`);
    } else {
      await loadLearningMaterials();
      setMessage(materialsMessage, `Learning material ${action === "approve" ? "approved and assigned" : "rejected"}.`);
    }
  } catch (error) {
    setMessage(materialsMessage, error.message, true);
    button.disabled = false;
  }
}

function formatClassDelivery(liveClass) {
  if (liveClass.deliveryMode === "location") return `TGFVP location · ${liveClass.locationName || "Location unavailable"}`;
  if (liveClass.deliveryMode === "venue") return `Other venue · ${liveClass.venue}`;
  return "Online meeting";
}

function renderAdminTimetables() {
  timetableList.replaceChildren();
  const search = timetableSearch.value.trim().toLowerCase();
  const filtered = adminTimetables.filter((liveClass) => {
    if (timetableStatusFilter.value !== "all" &&
        liveClass.approvalStatus !== timetableStatusFilter.value) return false;
    return !search || [
      liveClass.title,
      liveClass.teacherName,
      liveClass.teacherEmail,
      liveClass.programmeTitle,
      liveClass.moduleTitle,
      liveClass.locationName,
      liveClass.venue,
    ].some((value) => String(value || "").toLowerCase().includes(search));
  });
  if (!filtered.length) {
    timetableList.append(makeTag("p", "admin-empty",
      adminTimetables.length
        ? "No schedules match these filters."
        : "There are no active or reviewable timetable entries."));
    return;
  }
  for (const liveClass of filtered) {
    const row = makeTag("article", "admin-user");
    const details = makeTag("div", "admin-user-details");
    const startsAt = new Intl.DateTimeFormat("en-CM", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(liveClass.startsAt));
    details.append(
      makeTag("h3", "", liveClass.title),
      makeTag("p", "admin-location-subtitle", `${liveClass.programmeTitle} · ${liveClass.moduleTitle}`),
      makeTag("p", "admin-location-subtitle", `${liveClass.teacherName} · ${liveClass.teacherEmail}`),
      makeTag("p", "admin-location-subtitle", `${startsAt} · ${formatClassDelivery(liveClass)}`),
    );
    if (liveClass.rejectionReason) {
      details.append(makeTag("p", "admin-message is-error", `Decline reason: ${liveClass.rejectionReason}`));
    }
    const statusLabel = liveClass.isActive === false && liveClass.approvalStatus !== "rejected"
      ? "cancelled"
      : liveClass.approvalStatus;
    const status = makeTag(
      "span",
      statusLabel === "approved" ? "visibility-badge" : "visibility-badge is-hidden",
      statusLabel,
    );
    details.append(status);
    const actions = makeTag("div", "admin-user-controls material-review-actions");
    if (liveClass.approvalStatus === "pending") {
      const approve = makeTag("button", "small-action", "Approve");
      approve.type = "button";
      approve.addEventListener("click", () => void reviewAdminTimetable(liveClass, "approve", approve));
      const reject = makeTag("button", "small-action small-action-danger", "Decline");
      reject.type = "button";
      reject.addEventListener("click", () => void reviewAdminTimetable(liveClass, "reject", reject));
      actions.append(approve, reject);
    }
    const edit = makeTag("button", "small-action", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openTimetableEditor(liveClass));
    const remove = makeTag("button", "small-action small-action-danger", "Move to trash");
    remove.type = "button";
    remove.addEventListener("click", () => void trashAdminTimetable(liveClass, remove));
    actions.append(edit, remove);
    row.append(details, actions);
    timetableList.append(row);
  }
}

async function loadAdminTimetables() {
  setMessage(timetableMessage, "Loading timetable entries…");
  try {
    adminTimetables = await requestJson("/api/admin/timetables");
    renderAdminTimetables();
    setMessage(timetableMessage, "");
  } catch (error) {
    setMessage(timetableMessage, error.message, true);
    timetableList.replaceChildren(makeTag("p", "admin-empty", "Timetables are unavailable."));
  }
}

async function reviewAdminTimetable(liveClass, action, button) {
  const reason = action === "reject"
    ? await promptForRejectionReason(`Decline "${liveClass.title}"`)
    : "";
  if (action === "reject" && reason === null) return;
  button.disabled = true;
  try {
    await requestJson(`/api/admin/timetables/${encodeURIComponent(liveClass.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, ...(action === "reject" ? { reason } : {}) }),
    });
    await loadAdminTimetables();
    setMessage(timetableMessage, `Timetable ${action === "approve" ? "approved" : "declined"}.`);
  } catch (error) {
    setMessage(timetableMessage, error.message, true);
    button.disabled = false;
  }
}

function syncTimetableEditorFields() {
  const mode = document.querySelector("#timetable-editor-mode").value;
  for (const field of timetableEditorDialog.querySelectorAll("[data-timetable-editor-field]")) {
    field.hidden = field.dataset.timetableEditorField !== mode;
  }
  document.querySelector("#timetable-editor-url").required = mode === "online";
  document.querySelector("#timetable-editor-location").required = mode === "location";
  document.querySelector("#timetable-editor-venue").required = mode === "venue";
}

function openTimetableEditor(liveClass) {
  const moduleSelect = document.querySelector("#timetable-editor-module");
  const moduleOptions = [];
  for (const programme of programmes.filter((item) => item.isActive)) {
    for (const module of modulesByProgramme.get(programme.id) || []) {
      moduleOptions.push([module.id, `${programme.title} · Module ${module.position}: ${module.title}`]);
    }
  }
  addSelectOptions(moduleSelect, moduleOptions, liveClass.moduleId);
  const locationSelect = document.querySelector("#timetable-editor-location");
  const activeLocations = locations.filter((location) => location.isActive);
  addSelectOptions(
    locationSelect,
    activeLocations.map((location) => [location.id, `${location.city} · ${location.region}`]),
    liveClass.locationId || "",
  );
  const start = new Date(liveClass.startsAt);
  start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
  document.querySelector("#timetable-editor-id").value = liveClass.id;
  document.querySelector("#timetable-editor-title").value = liveClass.title;
  document.querySelector("#timetable-editor-start").value = start.toISOString().slice(0, 16);
  document.querySelector("#timetable-editor-mode").value = liveClass.deliveryMode;
  document.querySelector("#timetable-editor-url").value = liveClass.meetingUrl || "";
  document.querySelector("#timetable-editor-venue").value = liveClass.venue || "";
  setMessage(document.querySelector("#timetable-editor-message"), "");
  syncTimetableEditorFields();
  timetableEditorDialog.showModal();
}

async function saveAdminTimetable(event) {
  event.preventDefault();
  if (!timetableEditorForm.reportValidity()) return;
  const button = timetableEditorForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(document.querySelector("#timetable-editor-message"), "Saving timetable…");
  const mode = document.querySelector("#timetable-editor-mode").value;
  try {
    await requestJson(`/api/admin/timetables/${encodeURIComponent(document.querySelector("#timetable-editor-id").value)}`, {
      method: "PATCH",
      body: JSON.stringify({
        moduleId: document.querySelector("#timetable-editor-module").value,
        title: document.querySelector("#timetable-editor-title").value,
        startsAt: new Date(document.querySelector("#timetable-editor-start").value).toISOString(),
        deliveryMode: mode,
        meetingUrl: mode === "online" ? document.querySelector("#timetable-editor-url").value : "",
        locationId: mode === "location" ? document.querySelector("#timetable-editor-location").value : "",
        venue: mode === "venue" ? document.querySelector("#timetable-editor-venue").value : "",
      }),
    });
    timetableEditorDialog.close();
    await loadAdminTimetables();
    setMessage(timetableMessage, "Timetable saved.");
  } catch (error) {
    setMessage(document.querySelector("#timetable-editor-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function trashAdminTimetable(liveClass, button) {
  if (!window.confirm(`Move "${liveClass.title}" to the recoverable trash?`)) return;
  button.disabled = true;
  try {
    await requestJson(`/api/admin/timetables/${encodeURIComponent(liveClass.id)}`, { method: "DELETE" });
    await loadAdminTimetables();
    setMessage(timetableMessage, "Timetable moved to trash.");
  } catch (error) {
    setMessage(timetableMessage, error.message, true);
    button.disabled = false;
  }
}

function renderAdminTeacherProfiles() {
  teacherProfileList.replaceChildren();
  if (!adminTeacherProfiles.length) {
    teacherProfileList.append(makeTag("p", "admin-empty", "There are no active teacher accounts to review."));
    return;
  }
  for (const profile of adminTeacherProfiles) {
    const row = makeTag("article", "admin-user");
    const details = makeTag("div", "admin-user-details");
    if (profile.photoUrl) {
      const photo = document.createElement("img");
      photo.className = "teacher-profile-photo-preview";
      photo.src = profile.photoUrl;
      photo.alt = `${profile.name}'s profile photo`;
      details.append(photo);
    }
    details.append(
      makeTag("h3", "", profile.name),
      makeTag("p", "admin-location-subtitle", `${profile.email} · ${profile.title || "No professional title provided"}`),
      makeTag("p", "admin-location-subtitle", profile.biography || "No biography provided."),
      makeTag("p", "admin-location-subtitle", profile.qualifications || "No qualifications provided."),
      makeTag("p", "admin-location-subtitle", profile.assignedProgrammes.length
        ? `Tutor assigned to: ${profile.assignedProgrammes.join(", ")}`
        : "No approved class assignments yet."),
      makeTag("span", profile.isVisible ? "visibility-badge" : "visibility-badge is-hidden",
        profile.isVisible ? "Visible to learners" : "Hidden from learners"),
    );
    const toggle = makeTag("button", profile.isVisible ? "small-action small-action-danger" : "small-action",
      profile.isVisible ? "Hide profile" : "Publish profile");
    toggle.type = "button";
    toggle.addEventListener("click", () => void setTeacherProfileVisibility(profile, toggle));
    const account = users.find((user) => user.id === profile.id);
    const setPassword = makeTag("button", "small-action", "Reset password");
    setPassword.type = "button";
    setPassword.disabled = !account;
    setPassword.addEventListener("click", () => {
      if (account) openAccountPasswordDialog(account, teacherProfilesMessage);
    });
    row.append(details, toggle, setPassword);
    teacherProfileList.append(row);
  }
}

async function loadAdminTeacherProfiles() {
  setMessage(teacherProfilesMessage, "Loading teacher profiles…");
  try {
    adminTeacherProfiles = await requestJson("/api/admin/teacher-profiles");
    renderAdminTeacherProfiles();
    setMessage(teacherProfilesMessage, "");
  } catch (error) {
    setMessage(teacherProfilesMessage, error.message, true);
    teacherProfileList.replaceChildren(makeTag("p", "admin-empty", "Teacher profiles are unavailable."));
  }
}

async function setTeacherProfileVisibility(profile, button) {
  button.disabled = true;
  try {
    await requestJson(`/api/admin/teacher-profiles/${encodeURIComponent(profile.id)}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ isVisible: !profile.isVisible }),
    });
    await loadAdminTeacherProfiles();
    setMessage(teacherProfilesMessage, `Profile ${profile.isVisible ? "hidden" : "published"}.`);
  } catch (error) {
    setMessage(teacherProfilesMessage, error.message, true);
    button.disabled = false;
  }
}

function renderPendingAccounts() {
  pendingAccountList.replaceChildren();
  pendingAccountCount.textContent = String(pendingAccounts.length);
  pendingAccountNavCount.textContent = String(pendingAccounts.length);
  pendingAccountNavCount.hidden = pendingAccounts.length === 0;
  if (!pendingAccounts.length) {
    pendingAccountList.append(makeTag("p", "admin-empty", "There are no student registrations waiting for approval."));
    return;
  }
  for (const account of pendingAccounts) {
    const row = makeTag("article", "admin-user pending-account-row");
    const details = makeTag("div", "admin-user-details");
    const registered = new Intl.DateTimeFormat("en-CM", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(account.registeredAt));
    details.append(
      makeTag("h3", "", account.fullName),
      makeTag("p", "admin-location-subtitle", account.email),
      makeTag("p", "admin-location-subtitle", `Course: ${account.courses} · Registered ${registered}`),
    );
    const actions = makeTag("div", "admin-user-controls");
    const approve = makeTag("button", "small-action pending-account-approve", "Approve");
    approve.type = "button";
    approve.addEventListener("click", () => void reviewPendingAccount(account, "approve", approve));
    const reject = makeTag("button", "small-action small-action-danger", "Reject");
    reject.type = "button";
    reject.addEventListener("click", () => openRejectAccount(account));
    actions.append(approve, reject);
    row.append(details, actions);
    pendingAccountList.append(row);
  }
}

async function loadPendingAccounts() {
  try {
    pendingAccounts = await requestJson("/api/admin/pending-accounts");
    renderPendingAccounts();
    setMessage(pendingAccountMessage, "");
  } catch (error) {
    setMessage(pendingAccountMessage, error.message, true);
  }
}

async function reviewPendingAccount(account, action, button) {
  button.disabled = true;
  setMessage(pendingAccountMessage, `${action === "approve" ? "Approving" : "Rejecting"} ${account.fullName}…`);
  try {
    await requestJson(`/api/admin/pending-accounts/${encodeURIComponent(account.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, ...(action === "reject" ? { reason: rejectAccountReason.value.trim() } : {}) }),
    });
    await Promise.all([loadPendingAccounts(), loadUsers()]);
    setMessage(pendingAccountMessage, `${account.fullName}'s account was ${action === "approve" ? "approved" : "rejected"}.`);
    return true;
  } catch (error) {
    setMessage(action === "reject" ? rejectAccountMessage : pendingAccountMessage, error.message, true);
    button.disabled = false;
    return false;
  }
}

function openRejectAccount(account) {
  accountBeingRejected = account;
  rejectAccountForm.reset();
  setMessage(rejectAccountMessage, "");
  rejectAccountDialog.showModal();
  rejectAccountReason.focus();
}

function promptForRejectionReason(title) {
  return new Promise((resolve) => {
    finishRejectionReason = (reason) => {
      finishRejectionReason = null;
      resolve(reason);
      rejectionReasonDialog.close();
    };
    document.querySelector("#rejection-reason-title").textContent = title;
    rejectionReasonForm.reset();
    setMessage(rejectionReasonMessage, "");
    rejectionReasonDialog.showModal();
    rejectionReasonText.focus();
  });
}

async function reviewPayment(request, action, button) {
  button.disabled = true;
  const statusMessage = document.querySelector("[data-admin-view-panel=payments]").hidden
    ? enrollmentMessage
    : paymentsMessage;
  const reason = action === "reject"
    ? await promptForRejectionReason(`Decline ${request.fullName}'s payment`)
    : "";
  if (action === "reject" && reason === null) {
    button.disabled = false;
    return;
  }
  if (action === "reject" && reason.trim().length < 5) {
    setMessage(enrollmentMessage, "Enter a rejection reason of at least 5 characters.", true);
    button.disabled = false;
    return;
  }
  setMessage(statusMessage, `${action === "approve" ? "Approving" : "Declining"} ${request.fullName}'s payment…`);
  try {
    await requestJson(`/api/admin/payments/${encodeURIComponent(request.paymentId)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, ...(action === "reject" ? { reason: reason.trim() } : {}) }),
    });
    await Promise.all([loadEnrollments(), loadPayments()]);
    setMessage(statusMessage, `${request.fullName}'s payment was ${action === "approve" ? "approved" : "declined"}.`);
  } catch (error) {
    setMessage(statusMessage, error.message, true);
    button.disabled = false;
  }
}

async function reviewEnrollment(request, action, button) {
  button.disabled = true;
  const reason = action === "reject"
    ? await promptForRejectionReason(`Reject ${request.fullName}'s enrollment`)
    : "";
  if (action === "reject" && reason === null) {
    button.disabled = false;
    return;
  }
  if (action === "reject" && reason.trim().length < 5) {
    setMessage(enrollmentMessage, "Enter a rejection reason of at least 5 characters.", true);
    button.disabled = false;
    return;
  }
  setMessage(enrollmentMessage, `${action === "approve" ? "Approving" : "Rejecting"} ${request.fullName}'s enrollment…`);
  try {
    await requestJson(`/api/admin/enrollments/${encodeURIComponent(request.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ action, ...(action === "reject" ? { reason: reason.trim() } : {}) }),
    });
    await Promise.all([loadEnrollments(), loadPayments()]);
    setMessage(enrollmentMessage, `${request.fullName}'s enrollment was ${action === "approve" ? "approved" : "rejected"}.`);
  } catch (error) {
    setMessage(enrollmentMessage, error.message, true);
    button.disabled = false;
  }
}
function openEditor(location = null) {
  setDashboardView("locations");
  setMessage(formMessage, "");
  locationForm.reset();
  locationIdField.value = location?.id || "";
  cityField.value = location?.city || "";
  regionField.value = location?.region || "";
  addressField.value = location?.address || "";
  descriptionField.value = location?.description || "";
  sortOrderField.value = String(location?.sortOrder ?? locations.length + 1);
  activeField.checked = location?.isActive ?? true;
  imageUrlField.value = location?.imageUrl || "";
  photoField.value = "";
  photoPreview.src = imageUrlField.value;
  photoPreviewWrap.hidden = !imageUrlField.value;
  editorHeading.textContent = location ? `Edit ${location.city}` : "Add a location";
  saveButton.firstChild.textContent = location ? "Save changes " : "Save location ";
  editorPanel.hidden = false;
  adminWorkspace.classList.add("is-editing");
  cityField.focus();
  editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editorPanel.hidden = true;
  adminWorkspace.classList.remove("is-editing");
  locationForm.reset();
  imageUrlField.value = "";
  photoPreview.removeAttribute("src");
  photoPreviewWrap.hidden = true;
  setMessage(formMessage, "");
}

async function uploadPhoto(file, folder = "tgfvp/locations") {
  const signature = await requestJson("/api/admin/cloudinary-signature", {
    method: "POST",
    body: JSON.stringify({ folder }),
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
    throw new Error("Photo upload failed. Check your connection and try again.");
  }

  let uploaded;
  try {
    uploaded = await response.json();
  } catch {
    throw new Error("Cloudinary returned an unreadable upload response.");
  }
  if (!response.ok || typeof uploaded.secure_url !== "string") {
    const message =
      typeof uploaded.error?.message === "string"
        ? uploaded.error.message
        : "Cloudinary could not upload this photo.";
    throw new Error(message);
  }
  return uploaded.secure_url;
}

async function deleteLocation(location) {
  if (!window.confirm(`Delete the ${location.city} location? This cannot be undone.`)) return;
  setMessage(dashboardMessage, `Deleting ${location.city}…`);
  try {
    await requestJson(`/api/admin/locations/${encodeURIComponent(location.id)}`, {
      method: "DELETE",
    });
    locations = locations.filter((item) => item.id !== location.id);
    renderLocations();
    setMessage(dashboardMessage, `${location.city} has been deleted.`);
  } catch (error) {
    setMessage(dashboardMessage, error.message, true);
    if (error.message.includes("sign in again")) showLogin();
  }
}

document.querySelector("#new-location").addEventListener("click", () => openEditor());
document.querySelector("#cancel-location").addEventListener("click", closeEditor);
document.querySelector("#cancel-location-form").addEventListener("click", closeEditor);
document.querySelector("#dismiss-credential").addEventListener("click", () => {
  credentialCard.hidden = true;
  credentialPassword.textContent = "";
  credentialEmail.textContent = "";
  credentialLoginLink.removeAttribute("href");
  setMessage(credentialMessage, "");
});
document.querySelector("#copy-credential").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(
      `Email: ${credentialEmail.textContent}\n${credentialIsTemporary ? "Temporary password" : "Password"}: ${credentialPassword.textContent}\nSign in: ${new URL(credentialLoginLink.href, window.location.origin).href}`,
    );
    button.textContent = "Login details copied";
  } catch {
    setMessage(credentialMessage, "Clipboard access is unavailable. Select and copy the login details above.", true);
  }
});

teacherAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!teacherAccountForm.reportValidity()) return;
  const password = teacherAccountForm.elements.password.value;
  if (password !== teacherAccountForm.elements.confirmPassword.value) {
    setMessage(teacherAccountFormMessage, "The passwords do not match.", true);
    teacherAccountForm.elements.confirmPassword.focus();
    return;
  }
  const button = teacherAccountForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(teacherAccountFormMessage, "");
  try {
    const result = await requestJson("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: teacherAccountForm.elements.fullName.value.trim(),
        email: teacherAccountForm.elements.email.value.trim(),
        password,
        role: "teacher",
        subsidiary: "tgfvp",
      }),
    });
    users.push(result.user);
    users.sort((left, right) => left.fullName.localeCompare(right.fullName));
    renderUsers();
    teacherAccountForm.reset();
    showCredential(
      result.user.fullName,
      result.temporaryPassword || password,
      result.user.email,
      result.user.role,
      Boolean(result.user.mustChangePassword),
    );
    setMessage(teacherAccountFormMessage, `Teacher account created for ${result.user.fullName}.`);
    await loadAdminTeacherProfiles();
  } catch (error) {
    setMessage(teacherAccountFormMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

function openAccountPasswordDialog(user, messageTarget = accountMessage) {
  accountBeingPasswordUpdated = user;
  accountPasswordStatusTarget = messageTarget;
  accountPasswordForm.reset();
  document.querySelector("#account-password-heading").textContent = `Set new password for ${user.fullName}`;
  setMessage(accountPasswordMessage, "");
  accountPasswordDialog.showModal();
  accountPasswordInput.focus();
}

accountPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!accountPasswordForm.reportValidity() || !accountBeingPasswordUpdated) return;
  if (accountPasswordInput.value !== accountPasswordConfirmation.value) {
    setMessage(accountPasswordMessage, "The passwords do not match.", true);
    accountPasswordConfirmation.focus();
    return;
  }

  saveAccountPasswordButton.disabled = true;
  const user = accountBeingPasswordUpdated;
  const saved = await saveUser(
    user,
    user.role,
    user.subsidiary,
    user.isFrozen,
    false,
    accountPasswordMessage,
    accountPasswordInput.value,
  );
  saveAccountPasswordButton.disabled = false;
  if (saved) {
    accountPasswordDialog.close();
    setMessage(accountPasswordStatusTarget, `Password updated for ${user.fullName}.`);
  }
});

accountPasswordDialog.addEventListener("close", () => {
  accountPasswordForm.reset();
  saveAccountPasswordButton.disabled = false;
  accountBeingPasswordUpdated = null;
});

document.querySelector("#cancel-account-password").addEventListener("click", () => {
  accountPasswordDialog.close();
});

document.querySelector("#remove-photo").addEventListener("click", () => {
  imageUrlField.value = "";
  photoField.value = "";
  photoPreview.removeAttribute("src");
  photoPreviewWrap.hidden = true;
});

document.querySelector("#new-board-member").addEventListener("click", () => openBoardEditor());
document.querySelector("#cancel-board-member").addEventListener("click", () => {
  boardForm.hidden = true;
  boardForm.reset();
  boardPhotoUrl.value = "";
  boardPhotoPreviewWrap.hidden = true;
  setMessage(boardFormMessage, "");
});

boardPhoto.addEventListener("change", async () => {
  const file = boardPhoto.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    boardPhoto.value = "";
    setMessage(boardFormMessage, "Choose a JPG, PNG or WebP portrait smaller than 8 MB.", true);
    return;
  }
  const button = document.querySelector("#save-board-member");
  button.disabled = true;
  setMessage(boardFormMessage, "Uploading the profile portrait to Cloudinary…");
  try {
    boardPhotoUrl.value = await uploadPhoto(file, "tgfvp/board");
    boardPhotoPreview.src = boardPhotoUrl.value;
    boardPhotoPreviewWrap.hidden = false;
    setMessage(boardFormMessage, "Portrait uploaded. Save the profile to publish it.");
  } catch (error) {
    boardPhoto.value = "";
    setMessage(boardFormMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

boardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!boardForm.reportValidity()) return;
  const button = document.querySelector("#save-board-member");
  const id = document.querySelector("#board-member-id").value;
  button.disabled = true;
  setMessage(boardFormMessage, "Saving profile…");
  try {
    const saved = await requestJson(
      id ? `/api/admin/board-members/${encodeURIComponent(id)}` : "/api/admin/board-members",
      {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({
          fullName: document.querySelector("#board-member-name").value,
          positionTitle: document.querySelector("#board-member-title").value,
          hierarchyGroup: document.querySelector("#board-member-group").value,
          biography: document.querySelector("#board-member-bio").value,
          photoUrl: boardPhotoUrl.value,
          sortOrder: Number(document.querySelector("#board-member-order").value),
          isActive: document.querySelector("#board-member-active").checked,
        }),
      },
    );
    const existing = boardMembers.findIndex((member) => member.id === saved.id);
    if (existing < 0) boardMembers.push(saved);
    else boardMembers[existing] = saved;
    boardMembers.sort((left, right) => hierarchyGroups.indexOf(left.hierarchyGroup) - hierarchyGroups.indexOf(right.hierarchyGroup) || left.sortOrder - right.sortOrder);
    renderBoardMembers();
    boardForm.hidden = true;
    boardForm.reset();
    setMessage(boardMessage, `${saved.fullName}'s profile was saved.`);
  } catch (error) {
    setMessage(boardFormMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

photoField.addEventListener("change", async () => {
  const file = photoField.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    photoField.value = "";
    setMessage(formMessage, "Choose a JPG, PNG or WebP image smaller than 8 MB.", true);
    return;
  }

  const uploadButtonText = saveButton.firstChild.textContent;
  saveButton.disabled = true;
  saveButton.firstChild.textContent = "Uploading photo… ";
  setMessage(formMessage, "Uploading photo to Cloudinary…");
  try {
    const imageUrl = await uploadPhoto(file);
    imageUrlField.value = imageUrl;
    photoPreview.src = imageUrl;
    photoPreviewWrap.hidden = false;
    setMessage(formMessage, "Photo uploaded. Save the location to publish it.");
  } catch (error) {
    photoField.value = "";
    setMessage(formMessage, error.message, true);
  } finally {
    saveButton.disabled = false;
    saveButton.firstChild.textContent = uploadButtonText;
  }
});

locationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!locationForm.reportValidity()) return;

  const id = locationIdField.value;
  const body = {
    city: cityField.value.trim(),
    region: regionField.value.trim(),
    address: addressField.value.trim(),
    description: descriptionField.value.trim(),
    imageUrl: imageUrlField.value,
    isActive: activeField.checked,
    sortOrder: Number(sortOrderField.value),
  };
  const originalLabel = saveButton.firstChild.textContent;
  saveButton.disabled = true;
  saveButton.firstChild.textContent = "Saving… ";
  setMessage(formMessage, "");
  try {
    const saved = await requestJson(
      id ? `/api/admin/locations/${encodeURIComponent(id)}` : "/api/admin/locations",
      { method: id ? "PATCH" : "POST", body: JSON.stringify(body) },
    );
    const existingIndex = locations.findIndex((location) => location.id === saved.id);
    if (existingIndex < 0) locations.push(saved);
    else locations[existingIndex] = saved;
    locations.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.city.localeCompare(right.city),
    );
    renderLocations();
    closeEditor();
    setMessage(dashboardMessage, `${saved.city} has been saved.`);
  } catch (error) {
    setMessage(formMessage, error.message, true);
    if (error.message.includes("sign in again")) showLogin();
  } finally {
    saveButton.disabled = false;
    saveButton.firstChild.textContent = originalLabel;
  }
});

const accountRoleField = document.querySelector("#account-role");
const accountSubsidiaryField = document.querySelector("#account-subsidiary");
addSelectOptions(accountRoleField, roleOptions, "operations");
addSelectOptions(accountSubsidiaryField, subsidiaryOptions, "tgfvp");
accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!accountForm.reportValidity()) return;
  const password = accountForm.elements.password.value;
  const confirmPassword = accountForm.elements.confirmPassword.value;
  if ((password || confirmPassword) && password !== confirmPassword) {
    setMessage(accountFormMessage, "The passwords do not match.", true);
    accountForm.elements.confirmPassword.focus();
    return;
  }
  const button = accountForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(accountFormMessage, "");
  try {
    const result = await requestJson("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: accountForm.elements.fullName.value.trim(),
        email: accountForm.elements.email.value.trim(),
        ...(password ? { password } : {}),
        role: accountForm.elements.role.value,
        subsidiary: accountForm.elements.subsidiary.value,
      }),
    });
    users.push(result.user);
    users.sort((left, right) => left.fullName.localeCompare(right.fullName));
    renderUsers();
    if (result.user.role === "learner") await loadAdminStudents();
    accountForm.reset();
    addSelectOptions(accountRoleField, roleOptions, "operations");
    addSelectOptions(accountSubsidiaryField, subsidiaryOptions, "tgfvp");
    showCredential(
      result.user.fullName,
      result.temporaryPassword || password,
      result.user.email,
      result.user.role,
      Boolean(result.user.mustChangePassword),
    );
    setMessage(accountMessage, `Account created for ${result.user.fullName}.`);
  } catch (error) {
    setMessage(accountFormMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

flyerFile.addEventListener("change", async () => {
  const file = flyerFile.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    flyerFile.value = "";
    setMessage(settingsMessage, "Choose a JPG, PNG or WebP image smaller than 8 MB.", true);
    return;
  }
  saveSettingsButton.disabled = true;
  setMessage(settingsMessage, "Uploading the flyer to Cloudinary…");
  try {
    flyerImageUrl.value = await uploadPhoto(file, "tgfvp/flyers");
    flyerPreview.src = flyerImageUrl.value;
    flyerPreviewWrap.hidden = false;
    setMessage(settingsMessage, "Flyer uploaded. Save the settings to publish it.");
  } catch (error) {
    flyerFile.value = "";
    setMessage(settingsMessage, error.message, true);
  } finally {
    saveSettingsButton.disabled = false;
  }
});

flyerDateField.addEventListener("input", () => {
  flyerPreviewDate.textContent = flyerDateField.value.toUpperCase();
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!settingsForm.reportValidity()) return;
  saveSettingsButton.disabled = true;
  setMessage(settingsMessage, "Saving website settings…");
  try {
    await requestJson("/api/admin/site-settings", {
      method: "PATCH",
      body: JSON.stringify({
        resumptionDate: settingsForm.elements.resumptionDate.value,
        resumptionLabel: settingsForm.elements.resumptionLabel.value.trim(),
        accentColor: settingsForm.elements.accentColor.value,
        flyerImageUrl: flyerImageUrl.value,
        flyerDateText: flyerDateField.value.trim(),
      }),
    });
    setMessage(settingsMessage, "Website settings saved and published.");
    flyerFile.value = "";
  } catch (error) {
    setMessage(settingsMessage, error.message, true);
  } finally {
    saveSettingsButton.disabled = false;
  }
});

programmeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!programmeForm.reportValidity()) return;
  const button = programmeForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await requestJson("/api/admin/programmes", {
      method: "POST",
      body: JSON.stringify({
        title: document.querySelector("#programme-title").value,
        description: document.querySelector("#programme-description").value,
        sortOrder: Number(document.querySelector("#programme-order").value),
        registrationFee: Number(document.querySelector("#programme-registration-fee").value),
        isActive: true,
      }),
    });
    programmeForm.reset();
    document.querySelector("#programme-order").value = "10";
    document.querySelector("#programme-registration-fee").value = "0";
    await loadProgrammes();
    setMessage(courseMessage, "Programme created. Add its modules below.");
  } catch (error) {
    setMessage(courseMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

moduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!moduleForm.reportValidity()) return;
  const button = moduleForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(moduleFormMessage, "");
  const moduleId = document.querySelector("#module-id").value;
  try {
    await requestJson(
      moduleId
        ? `/api/admin/modules/${encodeURIComponent(moduleId)}`
        : `/api/admin/programmes/${encodeURIComponent(document.querySelector("#module-programme").value)}/modules`,
      {
        method: moduleId ? "PATCH" : "POST",
        body: JSON.stringify({
          title: document.querySelector("#module-title").value,
          description: document.querySelector("#module-description").value,
          lessonContent: document.querySelector("#module-content").value,
          meetingUrl: document.querySelector("#module-meeting-url").value,
          position: Number(document.querySelector("#module-position").value),
          isReleased: document.querySelector("#module-released").checked,
        }),
      },
    );
    resetModuleEditor();
    await loadProgrammes();
    setMessage(courseMessage, moduleId ? "Module details saved." : "Module added. Manage its release above.");
  } catch (error) {
    setMessage(moduleFormMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#cancel-module-edit").addEventListener("click", () => {
  resetModuleEditor();
  setMessage(moduleFormMessage, "");
});

document.querySelectorAll("[data-admin-view]").forEach((control) => {
  control.addEventListener("click", () => setDashboardView(control.dataset.adminView));
});

document.querySelector("#refresh-overview").addEventListener("click", () => void loadAdminOverview());
document.querySelector("#refresh-students").addEventListener("click", () => void loadAdminStudents());
document.querySelector("#refresh-pending-accounts").addEventListener("click", () => void loadPendingAccounts());
document.querySelector("#refresh-materials").addEventListener("click", () => void loadLearningMaterials());
document.querySelector("#refresh-course-submissions").addEventListener("click", () => void loadCourseSubmissions());
document.querySelector("#refresh-payments").addEventListener("click", () => void loadPayments());
document.querySelector("#refresh-timetables").addEventListener("click", () => void loadAdminTimetables());
document.querySelector("#refresh-teacher-profiles").addEventListener("click", () => void loadAdminTeacherProfiles());
document.querySelector("#refresh-attendance").addEventListener("click", () => void loadAdminActivity());
document.querySelector("#refresh-trash").addEventListener("click", () => void loadAdminTrash());
attendanceCategoryFilter.addEventListener("change", () => void loadAdminActivity());
attendancePeriodFilter.addEventListener("change", () => void loadAdminActivity());
attendanceStatusFilter.addEventListener("change", () => void loadAdminActivity());
attendanceSearch.addEventListener("input", () => void loadAdminActivity());
timetableStatusFilter.addEventListener("change", renderAdminTimetables);
timetableSearch.addEventListener("input", renderAdminTimetables);
document.querySelector("#timetable-editor-mode").addEventListener("change", syncTimetableEditorFields);
timetableEditorForm.addEventListener("submit", (event) => void saveAdminTimetable(event));
document.querySelector("#cancel-timetable-edit").addEventListener("click", () => timetableEditorDialog.close());
paymentStatusFilter.addEventListener("change", renderPaymentManagement);
paymentReceiptStatusFilter.addEventListener("change", renderPaymentManagement);
paymentSearch.addEventListener("input", renderPaymentManagement);
studentSearch.addEventListener("input", renderAdminStudents);
studentStatusFilter.addEventListener("change", renderAdminStudents);
studentProgrammeFilter.addEventListener("change", renderAdminStudents);
memberSearch.addEventListener("input", renderUsers);
addSelectOptions(memberRoleFilter, [["all", "All roles"], ...roleOptions]);
addSelectOptions(memberSubsidiaryFilter, [["all", "All companies and teams"], ...subsidiaryOptions]);
memberRoleFilter.addEventListener("change", renderUsers);
memberSubsidiaryFilter.addEventListener("change", renderUsers);
document.querySelector("#close-student-modules").addEventListener("click", () => {
  studentModuleControls.hidden = true;
  studentModuleList.replaceChildren();
});
document.querySelector("#cancel-reject-account").addEventListener("click", () => rejectAccountDialog.close());
document.querySelector("#cancel-rejection-reason").addEventListener("click", () => {
  if (finishRejectionReason) finishRejectionReason(null);
});
rejectionReasonTemplate.addEventListener("change", () => {
  rejectionReasonText.value = rejectionReasonTemplate.value === "custom"
    ? ""
    : rejectionReasonTemplate.value;
});
rejectionReasonDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (finishRejectionReason) finishRejectionReason(null);
});
rejectionReasonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!rejectionReasonForm.reportValidity()) return;
  const reason = rejectionReasonText.value.trim();
  if (reason.length < 5) {
    setMessage(rejectionReasonMessage, "Enter a rejection reason of at least 5 characters.", true);
    return;
  }
  if (finishRejectionReason) finishRejectionReason(reason);
});
rejectAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!accountBeingRejected || !rejectAccountForm.reportValidity()) return;
  const button = document.querySelector("#confirm-reject-account");
  button.disabled = true;
  const reviewed = await reviewPendingAccount(accountBeingRejected, "reject", button);
  button.disabled = false;
  if (reviewed) {
    rejectAccountDialog.close();
    accountBeingRejected = null;
  }
});

window.setInterval(() => {
  if (dashboardPanel.hidden) return;
  if (!document.querySelector("[data-admin-view-panel=overview]").hidden) void loadAdminOverview();
  if (!document.querySelector("[data-admin-view-panel=students]").hidden) void loadAdminStudents();
  if (!document.querySelector("[data-admin-view-panel=payments]").hidden) void loadPayments();
}, 30000);

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const passwordInput = document.querySelector("#admin-password");
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, "");
  try {
    await requestJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: passwordInput.value }),
    });
    passwordInput.value = "";
    showDashboard();
    await Promise.all([loadLocations(), loadUsers(), loadSettings(), loadBoardMembers(), loadProgrammes(), loadEnrollments(), loadPendingAccounts()]);
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    await requestJson("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
    window.dispatchEvent(new Event("tgf-account-signed-out"));
    showLogin();
    closeEditor();
    locationList.replaceChildren();
    userList.replaceChildren();
    enrollmentList.replaceChildren();
    studentList.replaceChildren();
    loginForm.reset();
    document.querySelector("#admin-password").focus();
  } catch (error) {
    setMessage(dashboardMessage, error.message, true);
  } finally {
    signOutButton.disabled = false;
  }
});

async function initializeDashboard() {
  try {
    const result = await requestJson("/api/admin/session");
    if (result.authenticated) {
      showDashboard();
      await Promise.all([loadLocations(), loadUsers(), loadSettings(), loadBoardMembers(), loadProgrammes(), loadEnrollments(), loadPendingAccounts()]);
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    setMessage(loginMessage, error.message, true);
  }
}

void initializeDashboard();
