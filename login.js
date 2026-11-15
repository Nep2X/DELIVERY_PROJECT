// =========================
//   LOGIN PAGE SCRIPT
// =========================

const form = document.getElementById("loginForm");
const errBox = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const pwInput = document.getElementById("password");

// Deep link mula sa SPA (#/...), kung mayroon.
const nextRoute = (() => {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    return next.startsWith("#/") ? next : "";
})();

const goTo = (role) => {
    const staff = role === "Admin" || role === "Employee";
    if (!staff) return "rider.html";
    return nextRoute ? `index.html${nextRoute}` : "index.html#/dashboard";
};

const redirectFor = (role) => window.location.replace(goTo(role));

// Kung naka-login na, diretso na sa tamang page
(async () => {
    try {
        const res = await fetch("api/auth.php?action=me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && data.user && data.user.role) redirectFor(data.user.role);
    } catch (e) { /* hayaan, ipakita ang login form */ }
})();

document.getElementById("showPw").addEventListener("change", (e) => {
    pwInput.type = e.target.checked ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.style.display = "none";
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";
    document.getElementById("username").removeAttribute("aria-invalid");
    pwInput.removeAttribute("aria-invalid");

    try {
        const res = await fetch("api/auth.php?action=login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: document.getElementById("username").value.trim(),
                password: pwInput.value,
            }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Login failed.");
        if (!data.role) throw new Error("Login failed.");
        // Role ang basehan, hindi ang data.redirect, para pumasok sa SPA.
        redirectFor(data.role);
    } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = "block";
        document.getElementById("username").setAttribute("aria-invalid", "true");
        pwInput.setAttribute("aria-invalid", "true");
        pwInput.value = "";
        pwInput.focus();
        loginBtn.disabled = false;
        loginBtn.textContent = "Log In";
    }
});
