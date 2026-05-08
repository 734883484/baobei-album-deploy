import {
  createAlbum,
  fetchAlbums,
  fetchCurrentProfile,
  formatDate,
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

async function renderAlbums(list, container) {
  container.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "album-item";
    empty.innerHTML = `
      <div class="album-thumb">${thumbMarkup({})}</div>
      <div class="album-info">
        <div class="album-title">还没有相册页</div>
        <div class="album-meta">点击上方“新建相册页”开始记录</div>
      </div>
    `;
    empty.style.cursor = "default";
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
  const title = document.querySelector(".main-title");
  if (profile?.baby_nickname) {
    title.textContent = `${profile.baby_nickname}相册`;
  }

  const subtitle = document.querySelector(".subtitle");
  subtitle.innerHTML = `记录宝贝成长的每一个瞬间 <a href="#" id="logoutLink" style="color:#6B4423;margin-left:8px;text-decoration:none;">退出</a>`;
  document.getElementById("logoutLink").addEventListener("click", async (event) => {
    event.preventDefault();
    await signOut();
  });

  const listContainer = document.querySelector(".album-list");
  const btnNew = document.querySelector(".btn-new");
  const message = document.createElement("div");
  message.style.display = "none";
  message.style.fontSize = "12px";
  message.style.marginBottom = "10px";
  document.querySelector(".content").insertBefore(message, listContainer);

  async function refresh() {
    const albums = await fetchAlbums();
    await renderAlbums(albums, listContainer);
  }

  btnNew.addEventListener("click", async () => {
    const name = window.prompt("请输入相册名称");
    if (!name?.trim()) return;
    try {
      const album = await createAlbum(name.trim());
      window.location.href = `${PAGE_URLS.albumEdit}?album=${album.id}`;
    } catch (error) {
      showMessage(message, error.message || "创建失败");
    }
  });

  await refresh();
}

init();
