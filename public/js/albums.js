import {
  createAlbum,
  fetchAlbums,
  fetchCurrentProfile,
  formatDate,
  isBabyProfileComplete,
  mediaSummary,
  PAGE_URLS,
  requireSession,
  showMessage,
  signOut
} from "./common.js";

function thumbMarkup(album) {
  if (album.coverUrl) {
    return `<img src="${album.coverUrl}" alt="${album.name}">`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
}

function formatBabyAgeMessage(babyNickname, babyBirthDate) {
  if (!babyNickname || !babyBirthDate) {
    return "小九宝贝今天已经9个月啦，一起记录慢慢长大的每一天";
  }

  const birthDate = new Date(`${babyBirthDate}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return "小九宝贝今天已经9个月啦，一起记录慢慢长大的每一天";
  }

  const today = new Date();
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) {
    months -= 1;
  }
  months = Math.max(0, months);

  if (months < 12) {
    return `${babyNickname}宝贝今天已经${months}个月啦，一起记录慢慢长大的每一天`;
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const ageText = restMonths > 0 ? `${years}岁${restMonths}月` : `${years}岁`;
  return `${babyNickname}宝贝今天已经${ageText}啦，一起记录慢慢长大的每一天`;
}

function loadSavedDiaryMeta(albumId) {
  try {
    return JSON.parse(localStorage.getItem(`growth-diary:${albumId}`) || "{}");
  } catch {
    return {};
  }
}

function formatDiaryListDate(value) {
  const match = String(value || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (match) {
    return `${match[1]}.${String(match[2]).padStart(2, "0")}.${String(match[3]).padStart(2, "0")}`;
  }
  return formatDate(value);
}

function diaryTimestamp(album) {
  const saved = loadSavedDiaryMeta(album.id);

  const dateMatch = String(saved.date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (dateMatch) {
    const timeMatch = String(saved.time || "").match(/^(\d{1,2}):(\d{2})/);
    const timestamp = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch?.[1] || 0),
      Number(timeMatch?.[2] || 0)
    ).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const createdAt = new Date(album.created_at).getTime();
  return Number.isNaN(createdAt) ? 0 : createdAt;
}

function sortDiariesNewestFirst(list) {
  return [...list].sort((left, right) => {
    const diaryDifference = diaryTimestamp(right) - diaryTimestamp(left);
    if (diaryDifference !== 0) return diaryDifference;

    const createdDifference = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    if (createdDifference !== 0) return createdDifference;
    return String(left.id).localeCompare(String(right.id));
  });
}

async function renderAlbums(list, container, profile) {
  container.innerHTML = "";

  if (list.length === 0) {
    const babyName = profile?.baby_nickname || "小九";
    const empty = document.createElement("div");
    empty.className = "album-empty";
    empty.innerHTML = `
      <svg class="empty-illustration" viewBox="0 0 128 96" fill="none" aria-hidden="true">
        <circle cx="62" cy="50" r="26" fill="currentColor" opacity="0.38"/>
        <circle cx="43" cy="34" r="11" fill="currentColor" opacity="0.38"/>
        <circle cx="82" cy="34" r="11" fill="currentColor" opacity="0.38"/>
        <circle cx="53" cy="49" r="3" fill="#fff7e8"/>
        <circle cx="72" cy="49" r="3" fill="#fff7e8"/>
        <path d="M55 62c6 5 13 5 19 0" stroke="#fff7e8" stroke-width="4" stroke-linecap="round"/>
        <path d="M29 90c5-18 20-28 35-28s30 10 35 28" fill="currentColor" opacity="0.35"/>
        <path d="M75 16c7-7 16-8 25-4-4 8-11 13-22 14" fill="currentColor" opacity="0.3"/>
        <path d="M66 21c-4-9-11-14-22-14 2 10 8 17 19 20" fill="currentColor" opacity="0.22"/>
      </svg>
      <p>还没有日记，先写下${babyName}<br>今天的一个小瞬间吧。</p>
    `;
    container.appendChild(empty);
    return;
  }

  sortDiariesNewestFirst(list).forEach((album, index) => {
    const savedMeta = loadSavedDiaryMeta(album.id);
    const diaryTitle = savedMeta.title || album.name;
    const diaryDate = formatDiaryListDate(savedMeta.date || album.created_at);
    const diaryDateTime = [diaryDate, savedMeta.time].filter(Boolean).join(" · ");
    const item = document.createElement("div");
    item.className = `album-item${index === 0 ? " active" : ""}`;
    item.innerHTML = `
      <div class="album-thumb">${thumbMarkup(album)}</div>
      <div class="album-info">
        <div class="album-title">${diaryTitle}</div>
        <div class="album-meta">${mediaSummary(album.photoCount, album.videoCount)} · ${diaryDateTime}</div>
      </div>
      <button class="album-edit" type="button" aria-label="编辑${diaryTitle}" title="编辑日记">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    `;
    item.addEventListener("click", () => {
      window.location.href = `${PAGE_URLS.album}?album=${album.id}`;
    });
    item.querySelector(".album-edit").addEventListener("click", (event) => {
      event.stopPropagation();
      window.location.href = `${PAGE_URLS.albumEdit}?album=${encodeURIComponent(album.id)}`;
    });
    container.appendChild(item);
  });
}

async function init() {
  await requireSession();
  const profile = await fetchCurrentProfile();
  if (!isBabyProfileComplete(profile)) {
    window.location.href = PAGE_URLS.setup;
    return;
  }
  const title = document.querySelector(".main-title");
  if (profile?.baby_nickname) {
    title.textContent = `${profile.baby_nickname}成长日记`;
  }

  const subtitle = document.querySelector(".subtitle");
  subtitle.textContent = formatBabyAgeMessage(profile?.baby_nickname, profile?.baby_birth_date);
  document.getElementById("logoutButton").addEventListener("click", async (event) => {
    event.preventDefault();
    await signOut();
  });

  const listContainer = document.querySelector(".album-list");
  const btnNew = document.querySelector(".btn-new");
  const modal = document.getElementById("createAlbumModal");
  const createForm = document.getElementById("createAlbumForm");
  const dateInput = document.getElementById("diaryDate");
  const topicInput = document.getElementById("diaryTopic");
  const noteInput = document.getElementById("diaryNote");
  const cancelCreate = document.getElementById("cancelCreateAlbum");
  const submitCreate = document.getElementById("submitCreateAlbum");
  const createMessage = document.getElementById("createAlbumMessage");
  const message = document.createElement("div");
  message.style.display = "none";
  message.style.fontSize = "12px";
  message.style.marginBottom = "10px";
  document.querySelector(".content").insertBefore(message, listContainer);

  async function refresh() {
    const albums = await fetchAlbums();
    await renderAlbums(albums, listContainer, profile);
  }

  function openCreateModal() {
    dateInput.value = "2026年5月28日 · 星期四";
    topicInput.value = "";
    noteInput.value = "";
    showMessage(createMessage, "");
    modal.classList.add("active");
    setTimeout(() => topicInput.focus(), 0);
  }

  function closeCreateModal() {
    modal.classList.remove("active");
    showMessage(createMessage, "");
  }

  btnNew.addEventListener("click", openCreateModal);
  cancelCreate.addEventListener("click", closeCreateModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCreateModal();
    }
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const diaryDate = dateInput.value.trim();
    const diaryTopic = topicInput.value.trim();
    const diaryNote = noteInput.value.trim();
    if (!diaryTopic) {
      showMessage(createMessage, "请输入主题");
      return;
    }

    const originalText = submitCreate.textContent;
    submitCreate.disabled = true;
    submitCreate.textContent = "准备中...";
    try {
      const album = await createAlbum(diaryTopic);
      closeCreateModal();
      const params = new URLSearchParams({
        album: album.id,
        date: diaryDate,
        topic: diaryTopic,
        note: diaryNote
      });
      window.location.href = `${PAGE_URLS.albumEdit}?${params.toString()}`;
    } catch (error) {
      console.log({ date: diaryDate, topic: diaryTopic, note: diaryNote });
      showMessage(createMessage, error.message || "保存失败");
      showMessage(message, error.message || "保存失败");
    } finally {
      submitCreate.disabled = false;
      submitCreate.textContent = originalText;
    }
  });

  await refresh();
}

init();
