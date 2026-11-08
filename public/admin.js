const loginPanel = document.querySelector("#login-panel");
const dashboardPanel = document.querySelector("#dashboard-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const dashboardMessage = document.querySelector("#dashboard-message");
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
const settingsForm = document.querySelector("#settings-form");
const settingsMessage = document.querySelector("#settings-message");
const flyerFile = document.querySelector("#flyer-file");
const flyerImageUrl = document.querySelector("#flyer-image-url");
const flyerPreview = document.querySelector("#flyer-preview");
const flyerPreviewWrap = document.querySelector("#flyer-preview-wrap");
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
const programmeForm = document.querySelector("#programme-form");
const moduleForm = document.querySelector("#module-form");
const moduleFormMessage = document.querySelector("#module-form-message");
let locations = [];
let users = [];
let boardMembers = [];
let programmes = [];
let modulesByProgramme = new Map();
let hierarchyGroups = [];
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
}

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
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
      const toggle = makeTag(
        "button",
        "small-action",
        programme.isActive ? "Close enrollment" : "Open enrollment",
      );
      toggle.type = "button";
      toggle.addEventListener("click", () => void toggleProgramme(programme));
      heading.append(details, toggle);
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
        actions.append(edit, release);
        item.append(titleWrap, actions);
        modules.append(item);
      }
      if (!modules.childElementCount) {
        modules.append(makeTag("p", "admin-empty", "No modules yet. Add the first module below."));
      }
      section.append(heading, modules);
      courseList.append(section);
    }
  }

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

function showCredential(name, password) {
  credentialName.textContent = `Temporary password for ${name}`;
  credentialPassword.textContent = password;
  credentialCard.hidden = false;
  credentialCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderUsers() {
  userList.replaceChildren();
  userCount.textContent = String(users.length);
  if (!users.length) {
    userList.append(makeTag("p", "admin-empty", "No team accounts have been created."));
    return;
  }

  for (const user of users) {
    const card = makeTag("article", "admin-user");
    const details = makeTag("div", "admin-user-details");
    details.append(
      makeTag("h3", "", user.fullName),
      makeTag("p", "admin-location-subtitle", user.email),
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
      user.isFrozen ? "Frozen" : "Active",
    );
    const save = makeTag("button", "small-action", "Save role");
    save.type = "button";
    save.addEventListener("click", () => void saveUser(user, role.value, subsidiary.value));
    const freeze = makeTag(
      "button",
      "small-action",
      user.isFrozen ? "Unfreeze" : "Freeze",
    );
    freeze.type = "button";
    freeze.addEventListener("click", () =>
      void saveUser(user, role.value, subsidiary.value, !user.isFrozen),
    );
    const reset = makeTag("button", "small-action", "Reset password");
    reset.type = "button";
    reset.addEventListener("click", () =>
      void saveUser(user, role.value, subsidiary.value, user.isFrozen, true),
    );
    const remove = makeTag("button", "small-action small-action-danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => void deleteUser(user));
    controls.append(role, subsidiary, status, save, freeze, reset, remove);
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
    programmes = await requestJson("/api/admin/programmes");
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
  } catch (error) {
    setMessage(courseMessage, error.message, true);
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

async function saveUser(user, role, subsidiary, isFrozen = user.isFrozen, resetPassword = false) {
  setMessage(accountMessage, `Updating ${user.fullName}…`);
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
      }),
    });
    users = users.map((item) => (item.id === user.id ? result.user : item));
    renderUsers();
    if (result.temporaryPassword) {
      showCredential(result.user.fullName, result.temporaryPassword);
      setMessage(accountMessage, "Password reset. The temporary password was shown once.");
    } else {
      setMessage(accountMessage, `${result.user.fullName} has been updated.`);
    }
  } catch (error) {
    setMessage(accountMessage, error.message, true);
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
    flyerPreview.src = settings.flyerImageUrl;
    flyerPreviewWrap.hidden = !settings.flyerImageUrl;
  } catch (error) {
    setMessage(settingsMessage, error.message, true);
  }
}

function openEditor(location = null) {
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
  cityField.focus();
  editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editorPanel.hidden = true;
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
});
document.querySelector("#copy-credential").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(credentialPassword.textContent);
    button.textContent = "Copied";
  } catch {
    setMessage(accountMessage, "Clipboard access is unavailable. Select and copy the password above.", true);
  }
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
  const button = accountForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(accountFormMessage, "");
  try {
    const result = await requestJson("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: accountForm.elements.fullName.value.trim(),
        email: accountForm.elements.email.value.trim(),
        role: accountForm.elements.role.value,
        subsidiary: accountForm.elements.subsidiary.value,
      }),
    });
    users.push(result.user);
    users.sort((left, right) => left.fullName.localeCompare(right.fullName));
    renderUsers();
    accountForm.reset();
    addSelectOptions(accountRoleField, roleOptions, "operations");
    addSelectOptions(accountSubsidiaryField, subsidiaryOptions, "tgfvp");
    showCredential(result.user.fullName, result.temporaryPassword);
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
        isActive: true,
      }),
    });
    programmeForm.reset();
    document.querySelector("#programme-order").value = "10";
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
    await Promise.all([loadLocations(), loadUsers(), loadSettings(), loadBoardMembers(), loadProgrammes()]);
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
    showLogin();
    closeEditor();
    locationList.replaceChildren();
    userList.replaceChildren();
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
      await Promise.all([loadLocations(), loadUsers(), loadSettings(), loadBoardMembers(), loadProgrammes()]);
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    setMessage(loginMessage, error.message, true);
  }
}

void initializeDashboard();
