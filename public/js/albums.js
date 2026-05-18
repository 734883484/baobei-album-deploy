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
  signOut,
  updateAlbum
} from "./common.js";

function thumbMarkup(album) {
  if (album.coverUrl) {
    return `<img src="${album.coverUrl}" alt="${album.name}">`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
}

function formatBabyAgeMessage(babyNickname, babyBirthDate) {
  if (!babyNickname || !babyBirthDate) {
    return "记录宝贝成长的每一个瞬间";
  }

  const birthDate = new Date(`${babyBirthDate}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return "记录宝贝成长的每一个瞬间";
  }

  const today = new Date();
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) {
    months -= 1;
  }
  months = Math.max(0, months);

  if (months < 12) {
    return `${babyNickname}宝贝今天已经${months}个月啦~`;
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths > 0
    ? `${babyNickname}宝贝今天已经${years}岁${restMonths}个月啦~`
    : `${babyNickname}宝贝今天已经${years}岁啦~`;
}

async function renderAlbums(list, container) {
  container.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "album-empty";
    empty.innerHTML = `
      <p>还没有相册页，先创建第一本宝贝记录吧。</p>
    `;
    container.appendChild(empty);
    return;
  }

  list.forEach((album, index) => {
    const item = document.createElement("div");
    item.className = `album-item${index === 0 ? " active" : ""}`;
    item.innerHTML = `
      <div class="album-thumb">${thumbMarkup(album)}</div>
      <div class="album-info">
        <div class="album-title">${album.name}</div>
        <div class="album-meta">${mediaSummary(album.photoCount, album.videoCount)} · ${formatDate(album.created_at)}</div>
      </div>
      <svg class="album-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    `;
    item.addEventListener("click", () => {
      window.location.href = `${PAGE_URLS.album}?album=${album.id}`;
    });
    item.querySelector(".album-edit").addEventListener("click", async (event) => {
      event.stopPropagation();
      const nextName = window.prompt("编辑相册名称", album.name)?.trim();
      if (!nextName || nextName === album.name) return;
      try {
        await updateAlbum(album.id, { name: nextName });
        const refreshed = await fetchAlbums();
        await renderAlbums(refreshed, container);
      } catch (error) {
        window.alert(error.message || "修改失败");
      }
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
    title.textContent = `${profile.baby_nickname}相册`;
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
  const createInput = document.getElementById("createAlbumName");
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
    await renderAlbums(albums, listContainer);
  }

  function openCreateModal() {
    createInput.value = "";
    showMessage(createMessage, "");
    modal.classList.add("active");
    setTimeout(() => createInput.focus(), 0);
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
    const name = createInput.value.trim();
    if (!name) {
      showMessage(createMessage, "请输入相册名称");
      return;
    }

    const originalText = submitCreate.textContent;
    submitCreate.disabled = true;
    submitCreate.textContent = "创建中...";
    try {
      const album = await createAlbum(name);
      closeCreateModal();
      window.location.href = `${PAGE_URLS.albumEdit}?album=${album.id}`;
    } catch (error) {
      showMessage(createMessage, error.message || "创建失败");
      showMessage(message, error.message || "创建失败");
    } finally {
      submitCreate.disabled = false;
      submitCreate.textContent = originalText;
    }
  });

  await refresh();
}

init();
