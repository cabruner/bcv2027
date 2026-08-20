import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CHECK_LINES = [
  "Consulting the carnivale bouncer…",
  "Checking the velvet rope…",
  "Asking the pigeons of Venice…",
  "Flipping through the gilt guest book…",
  "Whispering your name to the masquerade…",
];

const MIN_PASSWORD = 8;
const AUTH_REDIRECT_URL = `${location.origin}${location.pathname}`;

const els = {
  setupBanner: document.getElementById("setup-banner"),
  gate: document.getElementById("gate"),
  app: document.getElementById("app"),
  gateStatus: document.getElementById("gate-status"),
  emailForm: document.getElementById("email-form"),
  emailInput: document.getElementById("email"),
  emailStep: document.getElementById("email-step"),
  passwordStep: document.getElementById("password-step"),
  allowedEmailLabel: document.getElementById("allowed-email-label"),
  passwordForm: document.getElementById("password-form"),
  passwordInput: document.getElementById("password"),
  passwordConfirmRow: document.getElementById("password-confirm-row"),
  passwordConfirm: document.getElementById("password-confirm"),
  passwordSubmit: document.getElementById("password-submit"),
  modeSignup: document.getElementById("mode-signup"),
  modeSignin: document.getElementById("mode-signin"),
  signinHelp: document.getElementById("signin-help"),
  forgotPassword: document.getElementById("forgot-password"),
  resendConfirmation: document.getElementById("resend-confirmation"),
  backToEmail: document.getElementById("back-to-email"),
  resetStep: document.getElementById("reset-step"),
  resetForm: document.getElementById("reset-form"),
  resetPassword: document.getElementById("reset-password"),
  resetPasswordConfirm: document.getElementById("reset-password-confirm"),
  resetSubmit: document.getElementById("reset-submit"),
  deniedStep: document.getElementById("denied-step"),
  tryAnother: document.getElementById("try-another"),
  signOut: document.getElementById("sign-out"),
  userEmail: document.getElementById("user-email"),
};

let supabase = null;
let pendingEmail = "";
let authMode = "signup";
let recoveryMode = false;

function configReady() {
  const c = window.BCV_CONFIG || {};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}

// Content preview for local design work before Supabase exists.
// Localhost only, so ?preview can never reveal the private shell in production.
function isLocalPreview() {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  return local && new URLSearchParams(location.search).has("preview");
}

function hasRecoveryToken() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  return hash.get("type") === "recovery";
}

function authLinkError() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  return hash.get("error_description");
}

function clearAuthUrl() {
  history.replaceState({}, document.title, location.pathname);
}

function setStatus(msg, kind = "") {
  els.gateStatus.textContent = msg || "";
  els.gateStatus.dataset.kind = kind;
  els.gateStatus.hidden = !msg;
}

function showGateStep(step) {
  els.emailStep.hidden = step !== "email";
  els.passwordStep.hidden = step !== "password";
  els.resetStep.hidden = step !== "reset";
  els.deniedStep.hidden = step !== "denied";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  els.modeSignup.classList.toggle("active", isSignup);
  els.modeSignin.classList.toggle("active", !isSignup);
  els.modeSignup.setAttribute("aria-pressed", String(isSignup));
  els.modeSignin.setAttribute("aria-pressed", String(!isSignup));
  els.passwordConfirmRow.hidden = !isSignup;
  els.passwordConfirm.required = isSignup;
  els.signinHelp.hidden = isSignup;
  els.passwordSubmit.textContent = isSignup ? "Create password & enter" : "Sign in";
  els.passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
  setStatus("");
}

function clearPasswordFields() {
  els.passwordInput.value = "";
  els.passwordConfirm.value = "";
  els.resetPassword.value = "";
  els.resetPasswordConfirm.value = "";
}

function showApp(session) {
  clearPasswordFields();
  els.gate.hidden = true;
  els.app.hidden = false;
  els.userEmail.textContent = session?.user?.email || "";
}

function resetGateFields() {
  pendingEmail = "";
  els.emailInput.value = "";
  clearPasswordFields();
}

function showGate() {
  recoveryMode = false;
  els.app.hidden = true;
  els.gate.hidden = false;
  resetGateFields();
  setAuthMode("signup");
  showGateStep("email");
  setStatus("");
}

function showRecovery() {
  recoveryMode = true;
  els.app.hidden = true;
  els.gate.hidden = false;
  showGateStep("reset");
  setStatus("Your reset link is ready.", "success");
  els.resetPassword.focus();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function humorousCheck() {
  const line = CHECK_LINES[Math.floor(Math.random() * CHECK_LINES.length)];
  setStatus(line, "checking");
  await sleep(900 + Math.random() * 700);
}

async function onEmailSubmit(event) {
  event.preventDefault();
  if (!supabase) return;

  const email = els.emailInput.value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    setStatus("That doesn’t look like an email. Try again?", "error");
    return;
  }

  const submit = els.emailForm.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await humorousCheck();

    const { data, error } = await supabase.rpc("is_email_allowed", {
      check_email: email,
    });

    if (error) {
      console.error(error);
      setStatus(
        "The bouncer’s radio crackled. Couldn’t check the list — try again in a moment.",
        "error"
      );
      return;
    }

    if (!data) {
      showGateStep("denied");
      setStatus("");
      return;
    }

    pendingEmail = email;
    els.allowedEmailLabel.textContent = email;
    setAuthMode("signup");
    showGateStep("password");
    setStatus("You’re on the list. First visit? Create a password. Returning? Sign in.", "success");
    els.passwordInput.focus();
  } finally {
    submit.disabled = false;
  }
}

function isExistingAccount(data) {
  return Boolean(data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
}

async function onPasswordSubmit(event) {
  event.preventDefault();
  if (!supabase || !pendingEmail) return;

  const password = els.passwordInput.value;
  const confirm = els.passwordConfirm.value;

  if (password.length < MIN_PASSWORD) {
    setStatus(`Password needs at least ${MIN_PASSWORD} characters.`, "error");
    return;
  }

  if (authMode === "signup" && password !== confirm) {
    setStatus("Those passwords don’t match — one more time?", "error");
    return;
  }

  els.passwordSubmit.disabled = true;
  setStatus(authMode === "signup" ? "Sewing your mask…" : "Parting the curtains…", "checking");

  try {
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: pendingEmail,
        password,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });

      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          setAuthMode("signin");
          setStatus("This email already has an account. Sign in or reset your password.", "error");
          return;
        }
        if (/guest list|not on/i.test(error.message)) {
          showGateStep("denied");
          setStatus("");
          return;
        }
        setStatus("We couldn’t create the account. Please try again in a moment.", "error");
        return;
      }

      if (isExistingAccount(data)) {
        setAuthMode("signin");
        setStatus("This email already has an account. Sign in or reset your password.", "error");
        return;
      }

      if (!data.session) {
        setAuthMode("signin");
        setStatus("Check your inbox to confirm your email, then sign in here.", "success");
        return;
      }

      showApp(data.session);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: pendingEmail,
      password,
    });

    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        setStatus("Your password may be correct, but your email still needs confirmation. Check your inbox or resend the confirmation.", "error");
      } else if (/invalid login credentials/i.test(error.message)) {
        setStatus("That email and password combination didn’t work. Try again or reset your password.", "error");
      } else {
        setStatus("We couldn’t sign you in just now. Please try again in a moment.", "error");
      }
      return;
    }

    showApp(data.session);
  } finally {
    els.passwordSubmit.disabled = false;
  }
}

async function onForgotPassword() {
  if (!supabase || !pendingEmail) return;

  els.forgotPassword.disabled = true;
  setStatus("Preparing your password reset email…", "checking");
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(pendingEmail, {
      redirectTo: AUTH_REDIRECT_URL,
    });
    if (error) {
      setStatus("We couldn’t send a reset email just now. Please wait a moment and try again.", "error");
      return;
    }
    setStatus("If this address has an account, a password reset link is on its way. Check spam too.", "success");
  } finally {
    els.forgotPassword.disabled = false;
  }
}

async function onResendConfirmation() {
  if (!supabase || !pendingEmail) return;

  els.resendConfirmation.disabled = true;
  setStatus("Sending a fresh confirmation email…", "checking");
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error) {
      setStatus("We couldn’t resend the confirmation just now. Please wait a moment and try again.", "error");
      return;
    }
    setStatus("A fresh confirmation email is on its way. Check spam too.", "success");
  } finally {
    els.resendConfirmation.disabled = false;
  }
}

async function onResetSubmit(event) {
  event.preventDefault();
  if (!supabase || !recoveryMode) return;

  const password = els.resetPassword.value;
  const confirm = els.resetPasswordConfirm.value;

  if (password.length < MIN_PASSWORD) {
    setStatus(`Password needs at least ${MIN_PASSWORD} characters.`, "error");
    return;
  }
  if (password !== confirm) {
    setStatus("Those passwords don’t match — one more time?", "error");
    return;
  }

  els.resetSubmit.disabled = true;
  setStatus("Saving your new password…", "checking");
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("This reset link may have expired. Request a new one and try again.", "error");
      return;
    }

    recoveryMode = false;
    clearAuthUrl();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showApp(session);
    } else {
      showGate();
      setStatus("Password updated. Sign in with your new password.", "success");
    }
  } finally {
    els.resetSubmit.disabled = false;
  }
}

function backToEmail() {
  pendingEmail = "";
  els.passwordInput.value = "";
  els.passwordConfirm.value = "";
  showGateStep("email");
  setStatus("");
  els.emailInput.focus();
}

function attachEventListeners() {
  els.emailForm.addEventListener("submit", onEmailSubmit);
  els.passwordForm.addEventListener("submit", onPasswordSubmit);
  els.resetForm.addEventListener("submit", onResetSubmit);
  els.modeSignup.addEventListener("click", () => setAuthMode("signup"));
  els.modeSignin.addEventListener("click", () => setAuthMode("signin"));
  els.forgotPassword.addEventListener("click", onForgotPassword);
  els.resendConfirmation.addEventListener("click", onResendConfirmation);
  els.backToEmail.addEventListener("click", (event) => {
    event.preventDefault();
    backToEmail();
  });
  els.tryAnother.addEventListener("click", backToEmail);
  els.signOut.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

async function init() {
  if (isLocalPreview()) {
    els.setupBanner.hidden = true;
    els.gate.hidden = true;
    els.app.hidden = false;
    els.userEmail.textContent = "preview (not signed in)";
    els.signOut.hidden = true;
    return;
  }

  if (!configReady()) {
    els.setupBanner.hidden = false;
    els.gate.hidden = true;
    els.app.hidden = true;
    return;
  }

  els.setupBanner.hidden = true;
  const recoveryCallback = hasRecoveryToken();
  supabase = createClient(
    window.BCV_CONFIG.supabaseUrl,
    window.BCV_CONFIG.supabaseAnonKey
  );
  attachEventListeners();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      showRecovery();
    } else if (event === "SIGNED_OUT") {
      showGate();
    } else if (session && !recoveryMode) {
      showApp(session);
    }
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if ((recoveryMode || recoveryCallback) && session) {
    showRecovery();
  } else if (session) {
    showApp(session);
  } else {
    showGate();
    const linkError = authLinkError();
    if (linkError || recoveryCallback) {
      clearAuthUrl();
      setStatus("That email link has expired or was already used. Request a fresh link and try again.", "error");
    }
  }
}

init().catch((error) => {
  console.error(error);
  setStatus("Something went sideways loading the gate.", "error");
});
