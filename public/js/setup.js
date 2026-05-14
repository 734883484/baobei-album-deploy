import {
  fetchCurrentProfile,
  isBabyProfileComplete,
  PAGE_URLS,
  showMessage,
  updateBabyProfile
} from "./common.js";

async function init() {
  const profile = await fetchCurrentProfile();
  if (isBabyProfileComplete(profile)) {
    window.location.href = PAGE_URLS.albums;
    return;
  }

  const form = document.getElementById("setupForm");
  const nicknameInput = document.getElementById("babyNickname");
  const birthDateInput = document.getElementById("babyBirthDate");
  const message = document.getElementById("setupMessage");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const babyNickname = nicknameInput.value.trim();
    const babyBirthDate = birthDateInput.value;

    if (!babyNickname || !babyBirthDate) {
      showMessage(message, "请填写宝贝昵称和出生年月日");
      return;
    }

    const birthDate = new Date(`${babyBirthDate}T00:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
      showMessage(message, "请选择正确的出生日期");
      return;
    }

    const button = form.querySelector(".btn-save");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "保存中...";
    showMessage(message, "");

    try {
      await updateBabyProfile({ babyNickname, babyBirthDate });
      window.location.href = PAGE_URLS.albums;
    } catch (error) {
      showMessage(message, error.message || "保存失败，请重试");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

init();
