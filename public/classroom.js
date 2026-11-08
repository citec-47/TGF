const studentLoginPanel = document.querySelector("#student-login-panel");
const studentDashboard = document.querySelector("#student-dashboard");
const studentLessonPanel = document.querySelector("#student-lesson-panel");
const studentCourseList = document.querySelector("#student-course-list");
const teacherLoginPanel = document.querySelector("#teacher-login-panel");
const teacherDashboard = document.querySelector("#teacher-dashboard");
const teacherRoom = document.querySelector("#teacher-room");
const teacherLiveRoom = document.querySelector("#teacher-live-room");
const classroomSignOut = document.querySelector("#classroom-sign-out");
const isStudentPage = Boolean(studentDashboard);
const isTeacherPage = Boolean(teacherDashboard);
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
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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
  paths.loginPanel.hidden = false;
  paths.dashboard.hidden = true;
  if (studentLessonPanel) studentLessonPanel.hidden = true;
  if (teacherRoom) teacherRoom.hidden = true;
  if (teacherLiveRoom) teacherLiveRoom.hidden = true;
  classroomSignOut.hidden = true;
  if (message) showMessage(paths.loginMessage, message, error);
}

async function loadStudentCourses() {
  showMessage(document.querySelector("#student-course-message"), "Loading your learning pathway…");
  studentCourseList.replaceChildren();
  try {
    const programmes = await requestJson("/api/student/courses");
    if (!programmes.length) {
      studentCourseList.append(
        node("p", "leadership-empty", "There are no programmes open for enrollment yet. Please check back soon."),
      );
      showMessage(document.querySelector("#student-course-message"), "");
      return;
    }
    for (const programme of programmes) {
      const card = node("article", "course-card");
      const header = node("div", "course-admin-card");
      const heading = node("div", "admin-panel-heading");
      const description = node("div");
      description.append(
        node("p", "micro-label", programme.enrolled ? "Your learning pathway" : "TGFVP programme"),
        node("h2", "", programme.title),
        node("p", "admin-intro", programme.description || "Contact TGFVP for programme details."),
      );
      const badge = node(
        "span",
        programme.isActive ? "enrollment-badge is-open" : "enrollment-badge",
        programme.isActive ? "Enrollment open" : "Enrollment closed",
      );
      heading.append(description, badge);
      header.append(heading);
      card.append(header);

      if (!programme.enrolled) {
        const actions = node("div", "course-actions");
        actions.append(
          createButton("Enroll in this programme", async () => {
            try {
              await requestJson("/api/student/enrollments", {
                method: "POST",
                body: JSON.stringify({ programmeId: programme.id }),
              });
              await loadStudentCourses();
            } catch (error) {
              showMessage(document.querySelector("#student-course-message"), error.message, true);
            }
          }, "button button-orange"),
        );
        card.append(actions);
      } else {
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
            node("h3", "", module.title),
            node(
              "p",
              "",
              module.completed
                ? "Completed"
                : module.isUnlocked
                  ? module.description || "Ready to study"
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
        const liveClasses = (programme.liveClasses || []).filter(
          (liveClass) => new Date(liveClass.startsAt).getTime() >= Date.now() - 2 * 60 * 60 * 1000,
        );
        if (liveClasses.length) {
          const classList = node("div", "live-class-list");
          classList.append(node("h3", "micro-label", "Upcoming live classes"));
          for (const liveClass of liveClasses) {
            const classCard = node("article", "live-class-card");
            const details = node("div");
            const when = new Intl.DateTimeFormat("en-CM", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(liveClass.startsAt));
            details.append(
              node("h3", "", liveClass.title),
              node("p", "", `${liveClass.moduleTitle} · ${when}`),
            );
            classCard.append(
              details,
              createButton("Join class", () => void joinStudentClass(liveClass), "button button-orange"),
            );
            classList.append(classCard);
          }
          card.append(classList);
        }
      }
      studentCourseList.append(card);
    }
    showMessage(document.querySelector("#student-course-message"), "");
  } catch (error) {
    showMessage(document.querySelector("#student-course-message"), error.message, true);
  }
}

async function openStudentLesson(module) {
  try {
    configureCanvas("student-board-canvas", false);
    await loadBoard(module.id, "student-board-canvas");
    document.querySelector("#student-lesson-title").textContent =
      `Module ${module.position}: ${module.title}`;
    document.querySelector("#student-lesson-description").textContent = module.description || "";
    document.querySelector("#student-lesson-content").textContent =
      module.lessonContent || "Your teacher will add learning content for this module.";
    document.querySelector("#complete-module").dataset.moduleId = module.id;
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
    startBoardRefresh(liveClass.moduleId, "student-live-board-canvas");
  } catch (error) {
    showMessage(document.querySelector("#student-course-message"), error.message, true);
  }
}

async function loadTeacherStudio() {
  showMessage(document.querySelector("#teacher-class-message"), "Loading your teaching studio…");
  try {
    const [modules, classes] = await Promise.all([
      requestJson("/api/teacher/modules"),
      requestJson("/api/teacher/classes"),
    ]);
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
    const moduleList = document.querySelector("#teacher-module-list");
    moduleList.replaceChildren();
    for (const module of modules) {
      const item = node("article", "teacher-module-card");
      const details = node("div");
      details.append(
        node("h3", "", `${module.programmeTitle} · Module ${module.position}: ${module.title}`),
        node("p", "", module.description || "No module summary."),
      );
      item.append(
        details,
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
      );
      item.append(
        details,
        createButton("Open class", () => void openTeacherClass(liveClass), "button button-orange"),
        createButton("Cancel", () => void cancelTeacherClass(liveClass), "small-action small-action-danger"),
      );
      classList.append(item);
    }
    showMessage(document.querySelector("#teacher-class-message"), "");
  } catch (error) {
    showMessage(document.querySelector("#teacher-class-message"), error.message, true);
  }
}

async function scheduleTeacherClass(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  showMessage(document.querySelector("#teacher-class-message"), "Scheduling live class…");
  try {
    await requestJson("/api/teacher/classes", {
      method: "POST",
      body: JSON.stringify({
        moduleId: document.querySelector("#live-module").value,
        title: document.querySelector("#live-class-title").value,
        startsAt: new Date(document.querySelector("#live-start-time").value).toISOString(),
        meetingUrl: document.querySelector("#live-meeting-url").value,
      }),
    });
    form.reset();
    await loadTeacherStudio();
    showMessage(document.querySelector("#teacher-class-message"), "Live class scheduled.");
  } catch (error) {
    showMessage(document.querySelector("#teacher-class-message"), error.message, true);
  } finally {
    button.disabled = false;
  }
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
    paths.dashboard.hidden = false;
  }
  classroomSignOut.hidden = false;
  if (isStudentPage) {
    if (account.role !== "learner") {
      showClassroomLogin("This page is for student accounts. Use your team portal for staff access.", true);
      return;
    }
    document.querySelector("#student-display-name").textContent = account.fullName;
    await loadStudentCourses();
  } else if (isTeacherPage) {
    if (account.role !== "teacher" && account.role !== "administrator") {
      showClassroomLogin("This page is for teacher accounts. Use your student learning space for learner access.", true);
      return;
    }
    document.querySelector("#teacher-display-name").textContent = account.fullName;
    document.querySelector("#teacher-admin-link").hidden = account.role !== "administrator";
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
          email: registerForm.elements.email.value.trim(),
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
  document.querySelector("#close-student-lesson").addEventListener("click", () => {
    stopBoardRefresh();
    studentLessonPanel.hidden = true;
    studentDashboard.hidden = false;
  });
  document.querySelector("#close-live-room").addEventListener("click", () => {
    stopBoardRefresh();
    studentLiveRoom.hidden = true;
    studentDashboard.hidden = false;
  });
}

const studentLiveRoom = document.querySelector("#live-room");
if (isTeacherPage) {
  document.querySelector("#teacher-class-form").addEventListener("submit", scheduleTeacherClass);
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
