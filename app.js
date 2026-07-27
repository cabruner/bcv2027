import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CHECK_LINES = [
  "Consulting the carnivale bouncer…",
  "Checking the velvet rope…",
  "Asking the pigeons of Venice…",
  "Flipping through the gilt guest book…",
  "Whispering your name to the masquerade…",
];

const MIN_PASSWORD = 8;

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
  backToEmail: document.getElementById("back-to-email"),
  deniedStep: document.getElementById("denied-step"),
  tryAnother: document.getElementById("try-another"),
  signOut: document.getElementById("sign-out"),
  userEmail: document.getElementById("user-email"),
};

let supabase = null;
let pendingEmail = "";
let authMode = "signup"; // signup | signin

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

function setStatus(msg, kind = "") {
  els.gateStatus.textContent = msg || "";
  els.gateStatus.dataset.kind = kind;
  els.gateStatus.hidden = !msg;
}

function showGateStep(step) {
  els.emailStep.hidden = step !== "email";
  els.passwordStep.hidden = step !== "password";
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
  els.passwordSubmit.textContent = isSignup ? "Create password & enter" : "Sign in";
  els.passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
  setStatus("");
}

function showApp(session) {
  els.gate.hidden = true;
  els.app.hidden = false;
  els.userEmail.textContent = session?.user?.email || "";
}

function showGate() {
  els.app.hidden = true;
  els.gate.hidden = false;
  pendingEmail = "";
  els.emailInput.value = "";
  els.passwordInput.value = "";
  els.passwordConfirm.value = "";
  setAuthMode("signup");
  showGateStep("email");
  setStatus("");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function humorousCheck() {
  const line = CHECK_LINES[Math.floor(Math.random() * CHECK_LINES.length)];
  setStatus(line, "checking");
  await sleep(900 + Math.random() * 700);
}

async function onEmailSubmit(e) {
  e.preventDefault();
  if (!supabase) return;

  const email = els.emailInput.value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    setStatus("That doesn’t look like an email. Try again?", "error");
    return;
  }

  els.emailForm.querySelector("button[type=submit]").disabled = true;
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
    setStatus("You’re on the list. The pigeons approve.", "success");
    els.passwordInput.focus();
  } finally {
    els.emailForm.querySelector("button[type=submit]").disabled = false;
  }
}

async function onPasswordSubmit(e) {
  e.preventDefault();
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
      });
      if (error) {
        // Already registered → nudge to sign-in
        if (/already|registered|exists/i.test(error.message)) {
          setAuthMode("signin");
          setStatus("You already have a password. Sign in instead.", "error");
          return;
        }
        if (/guest list|not on/i.test(error.message)) {
          showGateStep("denied");
          setStatus("");
          return;
        }
        setStatus(error.message, "error");
        return;
      }
      // If email confirmation is required, session may be null
      if (!data.session) {
        setStatus(
          "Almost! Check your inbox to confirm, then sign in. (Or turn off “Confirm email” in Supabase for smoother carnivale entry.)",
          "success"
        );
        setAuthMode("signin");
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
      setStatus("Hmm — that password didn’t work. Try again?", "error");
      return;
    }
    showApp(data.session);
  } finally {
    els.passwordSubmit.disabled = false;
  }
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
  supabase = createClient(
    window.BCV_CONFIG.supabaseUrl,
    window.BCV_CONFIG.supabaseAnonKey
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    showApp(session);
  } else {
    showGate();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showApp(session);
    else showGate();
  });

  els.emailForm.addEventListener("submit", onEmailSubmit);
  els.passwordForm.addEventListener("submit", onPasswordSubmit);
  els.modeSignup.addEventListener("click", () => setAuthMode("signup"));
  els.modeSignin.addEventListener("click", () => setAuthMode("signin"));
  els.backToEmail.addEventListener("click", (e) => {
    e.preventDefault();
    pendingEmail = "";
    els.passwordInput.value = "";
    els.passwordConfirm.value = "";
    showGateStep("email");
    setStatus("");
  });
  els.tryAnother.addEventListener("click", (e) => {
    e.preventDefault();
    showGateStep("email");
    setStatus("");
    els.emailInput.focus();
  });
  els.signOut.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

init().catch((err) => {
  console.error(err);
  setStatus("Something went sideways loading the gate.", "error");
});
