import { isConfigured, PAGE_URLS, registerAccount, showMessage } from "./common.js";

function togglePwd(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

window.togglePwd = togglePwd;

async function init() {
  const form = document.querySelector(".form");
  const nicknameInput = form.querySelector('input[type="text"]');
  const emailInput = form.querySelector('input[type="email"]');
  const passwordInput = document.getElementById("pwd1");
  const confirmInput = document.getElementById("pwd2");
  const loginLink = document.querySelector(".login-link a");
  const photo = document.querySelector(".baby-photo");
  const message = document.createElement("div");
  message.style.display = "none";
  message.style.fontSize = "12px";
  message.style.marginTop = "6px";
  form.insertBefore(message, form.querySelector(".btn-register"));

  loginLink.href = PAGE_URLS.login;
  if (photo) {
    photo.src = "./baby_photo.webp";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isConfigured()) {
      showMessage(message, "请先在 Vercel 环境变量中配置 Supabase URL 和 anon key。");
      return;
    }

    const nickname = nicknameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (!nickname || !email || !password || !confirmPassword) {
      showMessage(message, "请完整填写注册信息");
      return;
    }
    if (password.length < 6) {
      showMessage(message, "密码至少需要 6 位");
      return;
    }
    if (password !== confirmPassword) {
      showMessage(message, "两次输入的密码不一致");
      return;
    }

    const submitButton = form.querySelector(".btn-register");
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "注册中...";
    showMessage(message, "");

    try {
      await registerAccount({ nickname, email, password });
      showMessage(message, "注册成功，正在跳转登录页...", "success");
      setTimeout(() => {
        window.location.href = PAGE_URLS.login;
      }, 900);
    } catch (error) {
      showMessage(message, error.message || "注册失败，请重试");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
}

init();
