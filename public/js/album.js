import { fetchAlbum, fetchAlbumMedia, getAlbumIdFromQuery, PAGE_URLS, requireSession } from "./common.js";

const DEFAULT_DIARY_TITLE = "第一次去公园";
const DEFAULT_DIARY_DATE = "2026.05.29";
const DEFAULT_DIARY_STORY = "今天是小九成长里闪闪发光的一天。";

function diaryStorageKey(albumId) {
  return `growth-diary:${albumId}`;
}

function formatDiaryDate(value) {
  if (!value) return DEFAULT_DIARY_DATE;
  const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (match) {
    return `${match[1]}.${String(match[2]).padStart(2, "0")}.${String(match[3]).padStart(2, "0")}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DEFAULT_DIARY_DATE;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function loadDiaryMeta(albumId, album = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem(diaryStorageKey(albumId)) || "{}");
    return {
      title: saved.title || album.name || DEFAULT_DIARY_TITLE,
      date: formatDiaryDate(saved.date || album.created_at),
      time: saved.time || "",
      note: saved.note || "",
      story: saved.story || DEFAULT_DIARY_STORY
    };
  } catch {
    return {
      title: album.name || DEFAULT_DIARY_TITLE,
      date: formatDiaryDate(album.created_at),
      time: "",
      note: "",
      story: DEFAULT_DIARY_STORY
    };
  }
}

function renderMediaCard(item) {
  const mediaTag =
    item.media_type === "video"
      ? `<video src="${item.url}" controls preload="metadata"></video>`
      : `<img src="${item.url}" alt="相册内容">`;

  return `
    <div class="photo-card">
      <div class="photo-image">
        ${mediaTag}
      </div>
      <div class="photo-note">
        <span class="photo-note-text">${item.remark || ""}</span>
      </div>
    </div>
  `;
}

async function init() {
  const session = await requireSession();
  if (!session) return;

  const albumId = getAlbumIdFromQuery();
  if (!albumId) {
    window.location.href = PAGE_URLS.albums;
    return;
  }

  const goBack = () => {
    window.location.href = PAGE_URLS.albums;
  };
  const goToEdit = () => {
    window.location.href = `${PAGE_URLS.albumEdit}?album=${encodeURIComponent(albumId)}`;
  };

  window.goBack = goBack;
  window.goToEdit = goToEdit;
  document.getElementById("backToDirectoryButton")?.addEventListener("click", goBack);
  document.getElementById("editDiaryButton")?.addEventListener("click", goToEdit);

  const album = await fetchAlbum(albumId);
  const media = await fetchAlbumMedia(albumId);
  const meta = loadDiaryMeta(albumId, album);

  document.querySelector(".album-title").textContent = meta.title;
  document.querySelector(".album-date-value").textContent = [meta.date, meta.time].filter(Boolean).join(" · ");
  const noteText = document.getElementById("diaryNoteText");
  noteText.textContent = meta.note;
  noteText.hidden = !meta.note;
  document.getElementById("storyText").textContent = meta.story;

  const grid = document.querySelector(".photos-grid");
  grid.innerHTML = media.length
    ? media.map(renderMediaCard).join("")
    : `
      <div class="empty-view-card">
        还没有照片或视频
      </div>
    `;

  window.viewPhoto = function viewPhoto() {};
}

init().catch((error) => {
  console.error("成长日记加载失败", error);
});
