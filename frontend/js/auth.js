document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const ownerSignupForm = document.getElementById("ownerSignupForm");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (ownerSignupForm) {
    ownerSignupForm.addEventListener("submit", handleOwnerSignup);
  }
});

async function handleLogin(e) {
  e.preventDefault();

  const loginMessage = document.getElementById("loginMessage");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (loginMessage) {
    loginMessage.textContent = "Logging in...";
    loginMessage.className = "status-message center-align blue-text";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem("token", data.token);

    const profileData = data.user;
    localStorage.setItem("user", JSON.stringify(profileData));

    if (profileData.role === "super_admin" || profileData.role === "admin") {
      window.location.href = "../pages/admin-dashboard.html";
    } else if (profileData.role === "owner") {
      if (profileData.status && profileData.status !== "approved") {
        throw new Error("Your owner account is not approved by admin yet");
      }

      window.location.href = "../pages/owner-dashboard.html";
    } else {
      throw new Error("Unauthorized role");
    }

  } catch (error) {
    if (loginMessage) {
      loginMessage.textContent = error.message;
      loginMessage.className = "status-message center-align red-text";
    } else {
      M.toast({ html: error.message });
    }
  }
}

async function handleOwnerSignup(e) {
  e.preventDefault();

  const signupMessage = document.getElementById("signupMessage");

  const body = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value.trim(),
    pendingRestaurantName: document.getElementById("pendingRestaurantName").value.trim(),
    pendingRestaurantAddress: document.getElementById("pendingRestaurantAddress").value.trim(),
    pendingRestaurantPhone: document.getElementById("pendingRestaurantPhone").value.trim(),
    pendingRestaurantEmail: document.getElementById("pendingRestaurantEmail").value.trim()
  };

  try {
    if (signupMessage) {
      signupMessage.textContent = "Submitting request...";
      signupMessage.className = "status-message center-align blue-text";
    }

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Owner signup failed");
    }

    if (signupMessage) {
      signupMessage.textContent = "Signup request submitted. Please wait for admin approval.";
      signupMessage.className = "status-message center-align green-text";
    }

    M.toast({ html: "Signup request submitted successfully" });

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);

  } catch (error) {
    if (signupMessage) {
      signupMessage.textContent = error.message;
      signupMessage.className = "status-message center-align red-text";
    }

    M.toast({ html: error.message });
  }
}