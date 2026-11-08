const loginPanel = document.querySelector("#portal-login-panel");
const dashboardPanel = document.querySelector("#portal-dashboard");
const loginForm = document.querySelector("#portal-login-form");
const loginMessage = document.querySelector("#portal-login-message");
const passwordForm = document.querySelector("#portal-password-form");
const passwordMessage = document.querySelector("#portal-password-message");
const signOutButton = document.querySelector("#portal-sign-out");
const roleLabels = {
  administrator: "Administrator",
  executive: "Executive",
  subsidiary_manager: "Subsidiary manager",
  supervisor: "Supervisor",
  operations: "Operations",
  learner: "Learner",
};
const companyLabels = {
  central_administration: "Central administration",
  best_rides: "BEST RIDES Auto Services & Logistics",
  dehivas: "DEHIVAS",
  tgf_supersales: "TGF Supersales",
  tgfvp: "TGF Vocational Pathways",
};

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

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function showLogin(message = "") {
  loginPanel.hidden = false;
  dashboardPanel.hidden = true;
  signOutButton.hidden = true;
  if (message) setMessage(loginMessage, message, true);
}

function renderDashboard(account) {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  signOutButton.hidden = false;
  document.querySelector("#portal-name").textContent = account.fullName;
  document.querySelector("#portal-role").textContent =
    roleLabels[account.role] || "TGF Group team member";
  document.querySelector("#portal-company").textContent =
    companyLabels[account.subsidiary] || "TGF Group";
  document.querySelector("#portal-access-description").textContent =
    account.role === "administrator"
      ? "Your administrator role includes access to the TGF Group administration dashboard."
      : `Your ${roleLabels[account.role] || "team member"} account is assigned to ${companyLabels[account.subsidiary] || "TGF Group"}.`;
  document.querySelector("#portal-admin-link").hidden =
    account.role !== "administrator" || account.mustChangePassword;
  document.querySelector("#password-hint").textContent = account.mustChangePassword
    ? "For account security, change your temporary password before continuing. Use at least 14 characters."
    : "Use at least 14 characters. Never share your password.";
  if (account.mustChangePassword) {
    document.querySelector("#new-password").focus();
    setMessage(passwordMessage, "Change your temporary password to secure your account.");
  } else {
    setMessage(passwordMessage, "");
  }
}

async function loadSession() {
  try {
    const account = await requestJson("/api/dashboard/session");
    renderDashboard(account);
  } catch (error) {
    showLogin(error.message.includes("no longer active") ? error.message : "");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, "");
  try {
    await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: loginForm.elements.email.value.trim(),
        password: loginForm.elements.password.value,
      }),
    });
    loginForm.reset();
    const account = await requestJson("/api/dashboard/session");
    renderDashboard(account);
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!passwordForm.reportValidity()) return;
  const button = passwordForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(passwordMessage, "Updating your password…");
  try {
    await requestJson("/api/account/password", {
      method: "POST",
      body: JSON.stringify({ password: passwordForm.elements.password.value }),
    });
    passwordForm.reset();
    const account = await requestJson("/api/dashboard/session");
    renderDashboard(account);
    setMessage(passwordMessage, "Your password has been updated.");
  } catch (error) {
    setMessage(passwordMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    await requestJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    loginForm.reset();
    showLogin();
    document.querySelector("#portal-email").focus();
  } catch (error) {
    setMessage(passwordMessage, error.message, true);
  } finally {
    signOutButton.disabled = false;
  }
});

void loadSession();
