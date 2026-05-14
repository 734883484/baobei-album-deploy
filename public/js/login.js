import { getCurrentProfileIfAny, isConfigured, loginByNickname, PAGE_URLS, routeAfterAuth, showMessage } from "./common.js";

function togglePwd() {
  const input = document.getElementById("pwd");
  input.type = input.type === "password" ? "text" : "password";
}

window.togglePwd = togglePwd;

async function init() {
  const form = document.querySelector(".form");
  const nicknameInput = form.querySelector('input[type="text"]');
  const passwordInput = document.getElementById("pwd");
  const rememberInput = document.querySelector('.remember input[type="checkbox"]');
  const registerLink = document.querySelector(".register a");
  const forgotLink = document.querySelector(".forgot");
  const message = document.createElement("div");
  message.style.display = "none";
  message.style.fontSize = "12px";
  message.style.marginTop = "6px";
  form.insertBefore(message, form.querySelector(".btn-login"));

  registerLink.href = PAGE_URLS.register;
  forgotLink.href = "#";
  forgotLink.addEventListener("click", (event) => {
    event.preventDefault();
    showMessage(message, "部署包当前只包含登录、注册、目录和相册页，找回密码页可继续补充。");
  });

  const photo = document.querySelector(".baby-photo");
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
    const password = passwordInput.value;
    if (!nickname || !password) {
      showMessage(message, "请输入账号昵称和密码");
      return;
    }

    const submitButton = form.querySelector(".btn-login");
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "登录中...";
    showMessage(message, "");

    try {
      await loginByNickname(nickname, password, rememberInput.checked);
      const profile = await getCurrentProfileIfAny();
      routeAfterAuth(profile);
    } catch (error) {
      showMessage(message, error.message || "登录失败，请重试");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
}

init();
