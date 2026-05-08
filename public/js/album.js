import { fetchAlbum, fetchAlbumMedia, formatDate, getAlbumIdFromQuery, PAGE_URLS, requireSession } from "./common.js";

function renderMediaCard(item) {
  const mediaTag =
    item.media_type === "video"
      ? `<video class="photo-image" src="${item.url}" controls preload="metadata"></video>`
      : `<img class="photo-image" src="${item.url}" alt="相册内容">`;

  return `
    <div class="photo-card ${item.ratio === "4:3" ? "landscape" : ""}">
      <div class="photo-inner">
        ${mediaTag}
      </div>
      <div class="photo-note">${item.remark || ""}</div>
    </div>
  `;
}

async function init() {
  await requireSession();
  const albumId = getAlbumIdFromQuery();
  if (!albumId) {
    window.location.href = PAGE_URLS.albums;
    return;
  }

  const album = await fetchAlbum(albumId);
  const media = await fetchAlbumMedia(albumId);

  document.querySelector(".album-title").textContent = album.name;
  document.querySelector(".album-date").textContent = formatDate(album.created_at);

  const grid = document.querySelector(".photos-grid");
  grid.innerHTML = media.length
    ? media.map(renderMediaCard).join("")
    : `
      <div class="photo-card empty-card" style="width:240px;height:320px;display:flex;align-items:center;justify-content:center;color:#8B7355;">
        还没有照片或视频
      </div>
    `;

  window.goBack = function goBack() {
    window.location.href = PAGE_URLS.albums;
  };

  window.goToEdit = function goToEdit() {
    window.location.href = `${PAGE_URLS.albumEdit}?album=${albumId}`;
  };

  window.viewPhoto = function viewPhoto() {};
}

init();
