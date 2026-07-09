import {
  deletePhoto,
  fetchAlbum,
  fetchAlbumMedia,
  getAlbumIdFromQuery,
  insertPhoto,
  PAGE_URLS,
  requireSession,
  updatePhoto,
  uploadMedia
} from "./common.js";

let selectedSize = "3:4";
let editingPhoto = null;
let selectedFile = null;
let selectedMediaType = "photo";
let previewUrl = "";
let cropperInstance = null;
let albumId = null;
let diaryMeta = null;

const DEFAULT_DIARY_TITLE = "第一次去公园";
const DEFAULT_DIARY_DATE = "2026.05.29";
const DEFAULT_DIARY_STORY = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clearPreviewUrl() {
  unmountCropper();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }
}

function unmountCropper() {
  if (cropperInstance) {
    cropperInstance.unmount();
    cropperInstance = null;
  }
}

function ratioValue() {
  return selectedSize === "3:4" ? "3-4" : "4-3";
}

function selectedSizeText() {
  return selectedSize === "3:4" ? "3:4 竖版" : "4:3 横版";
}

function updateSelectedSizeHint() {
  const hint = document.getElementById("selectedSizeHint");
  if (hint) {
    hint.textContent = `已选：${selectedSizeText()}`;
  }
}

function queryValue(name) {
  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
}

function diaryStorageKey(id) {
  return `growth-diary:${id}`;
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

function loadDiaryMeta(album = {}) {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(diaryStorageKey(albumId)) || "{}");
    } catch {
      return {};
    }
  })();

  diaryMeta = {
    title: queryValue("topic") || saved.title || album.name || DEFAULT_DIARY_TITLE,
    date: formatDiaryDate(queryValue("date") || saved.date || album.created_at),
    story: saved.story || queryValue("note") || DEFAULT_DIARY_STORY
  };
  return diaryMeta;
}

function saveDiaryMeta() {
  if (!albumId || !diaryMeta) return;
  const storyInput = document.getElementById("storyInput");
  const payload = {
    ...diaryMeta,
    story: storyInput?.value.trim() || ""
  };
  localStorage.setItem(diaryStorageKey(albumId), JSON.stringify(payload));
}

function updateStoryCounter() {
  const storyInput = document.getElementById("storyInput");
  const counter = document.getElementById("storyCounter");
  if (storyInput && counter) {
    counter.textContent = `${storyInput.value.length}/500`;
  }
}

async function createCroppedImageFile() {
  if (!selectedFile || selectedMediaType === "video") return selectedFile;

  const croppedAreaPixels = cropperInstance?.getCroppedAreaPixels();
  if (!croppedAreaPixels) {
    return selectedFile;
  }

  const outputWidth = selectedSize === "3:4" ? 300 : 400;
  const outputHeight = selectedSize === "3:4" ? 400 : 300;
  const bitmap = await createImageBitmap(selectedFile);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(
    bitmap,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片裁剪失败，请重新选择照片"));
          return;
        }
        const name = selectedFile.name.replace(/\.[^.]+$/, "") || "photo";
        resolve(new File([blob], `${name}-cropped.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

function previewUpload(file) {
  const uploadArea = document.getElementById("uploadArea");
  const uploadContent = document.getElementById("uploadContent");
  uploadArea.classList.add("has-image");
  uploadArea.onclick = null;
  uploadArea.classList.toggle("is-portrait", selectedSize === "3:4" && !file.type.startsWith("video/"));
  uploadArea.classList.toggle("is-landscape", selectedSize === "4:3" && !file.type.startsWith("video/"));

  unmountCropper();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }
  previewUrl = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    uploadContent.innerHTML = `<video class="upload-preview" src="${previewUrl}" controls preload="metadata"></video>`;
  } else {
    uploadContent.innerHTML = `
      <div class="upload-cropper-wrap" id="cropViewport"></div>
    `;
    if (!window.BaobeiEasyCropper) {
      window.alert("裁剪组件加载失败，请刷新页面后重试");
      return;
    }
    cropperInstance = window.BaobeiEasyCropper.mount(document.getElementById("cropViewport"), {
      aspect: selectedSize === "3:4" ? 3 / 4 : 4 / 3,
      image: previewUrl,
      initialZoom: 1,
      minZoom: 0.2
    });
  }

  document.getElementById("reselectRow").style.display = "flex";
  document.getElementById("zoomGroup").style.display = file.type.startsWith("video/") ? "none" : "block";
}

function resetModal() {
  selectedSize = "3:4";
  editingPhoto = null;
  selectedFile = null;
  selectedMediaType = "photo";
  clearPreviewUrl();
  document.getElementById("modalTitle").textContent = "添加照片或视频";
  document.getElementById("stepsIndicator").style.display = "flex";
  document.getElementById("step1Content").style.display = "block";
  document.getElementById("step2Content").style.display = "none";
  document.getElementById("nextBtn").textContent = "下一步";
  document.getElementById("nextBtn").onclick = nextStep;
  document.getElementById("backBtn").style.display = "none";
  document.getElementById("noteInput").value = "";
  document.querySelector('input[name="photoSize"][value="3-4"]').checked = true;
  document.getElementById("uploadArea").classList.remove("has-image");
  document.getElementById("uploadArea").classList.remove("is-portrait", "is-landscape");
  document.getElementById("uploadArea").onclick = triggerUpload;
  document.getElementById("uploadContent").innerHTML = `
    <div class="upload-icon">📷</div>
    <div class="upload-text">点击上传照片或视频</div>
    <div class="upload-hint" id="selectedSizeHint">已选：3:4 竖版</div>
  `;
  document.getElementById("reselectRow").style.display = "none";
  document.getElementById("zoomGroup").style.display = "none";
  document.getElementById("zoomInput").value = "1";
  document.getElementById("fileInput").value = "";
}

function closeModal() {
  document.getElementById("photoModal").classList.remove("active");
  resetModal();
}

function selectSize(size) {
  selectedSize = size === "3-4" ? "3:4" : "4:3";
  updateSelectedSizeHint();
}

function nextStep() {
  document.getElementById("step1Indicator").classList.remove("active");
  document.getElementById("step1Indicator").classList.add("completed");
  document.getElementById("step2Indicator").classList.add("active");
  document.getElementById("step1Content").style.display = "none";
  document.getElementById("step2Content").style.display = "block";
  document.getElementById("backBtn").style.display = "inline-block";
  document.getElementById("nextBtn").textContent = "保存";
  document.getElementById("nextBtn").onclick = savePhoto;
  updateSelectedSizeHint();
}

function goToStep1() {
  document.getElementById("step1Indicator").classList.add("active");
  document.getElementById("step1Indicator").classList.remove("completed");
  document.getElementById("step2Indicator").classList.remove("active");
  document.getElementById("step1Content").style.display = "block";
  document.getElementById("step2Content").style.display = "none";
  document.getElementById("backBtn").style.display = "none";
  document.getElementById("nextBtn").textContent = "下一步";
  document.getElementById("nextBtn").onclick = nextStep;
}

function openAddModal() {
  resetModal();
  document.getElementById("modalTitle").textContent = "添加照片或视频";
  document.getElementById("photoModal").classList.add("active");
}

function triggerUpload() {
  document.getElementById("fileInput").click();
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  selectedFile = file;
  selectedMediaType = file.type.startsWith("video/") ? "video" : "photo";
  if (selectedMediaType === "video") {
    selectedSize = "4:3";
  }
  previewUpload(file);
}

function renderCard(item) {
  const mediaTag =
    item.media_type === "video"
      ? `<video src="${item.url}" controls preload="metadata"></video>`
      : `<img src="${item.url}" alt="照片">`;

  return `
    <div class="photo-card" data-id="${item.id}">
      <div class="photo-actions">
        <button class="photo-action-btn edit-action" data-action="edit" title="编辑">编辑</button>
        <button class="photo-action-btn delete-action" data-action="delete" title="删除"></button>
      </div>
      <div class="photo-image">${mediaTag}</div>
      <div class="photo-note">
        <span class="photo-note-text">${item.remark || ""}</span>
      </div>
    </div>
  `;
}

function renderPlaceholder() {
  return `<div class="photo-placeholder"><span class="photo-placeholder-icon"></span></div>`;
}

async function renderAlbum() {
  const album = await fetchAlbum(albumId);
  const media = await fetchAlbumMedia(albumId);
  const meta = loadDiaryMeta(album);
  document.querySelector(".album-title").textContent = meta.title;
  document.querySelector(".album-date-value").textContent = meta.date;
  const storyInput = document.getElementById("storyInput");
  if (storyInput && !storyInput.value) {
    storyInput.value = meta.story;
    updateStoryCounter();
  }

  const grid = document.querySelector(".photos-grid");
  const addCard = `
    <button class="add-photo-card" id="addCard" type="button">
      <div class="add-icon">+</div>
      <span class="add-text">添加照片或视频</span>
    </button>
  `;
  const placeholders = media.length ? "" : Array.from({ length: 5 }, renderPlaceholder).join("");
  grid.innerHTML = media.length ? media.map(renderCard).join("") + addCard : addCard + placeholders;

  const addedCount = document.getElementById("addedCount");
  if (addedCount) {
    addedCount.textContent = `已添加 ${media.length} 张`;
  }

  document.getElementById("addCard").addEventListener("click", openAddModal);
  grid.querySelectorAll(".photo-card[data-id]").forEach((card) => {
    const photo = media.find((item) => item.id === card.dataset.id);
    card.querySelector('[data-action="edit"]').addEventListener("click", () => editPhoto(photo));
    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!window.confirm("确定要删除这张照片或视频吗？")) return;
      await deletePhoto(photo);
      await renderAlbum();
    });
  });
}

function editPhoto(photo) {
  editingPhoto = photo;
  selectedFile = null;
  selectedMediaType = photo.media_type === "video" ? "video" : "photo";
  clearPreviewUrl();
  document.getElementById("modalTitle").textContent = "编辑照片或视频";
  document.getElementById("stepsIndicator").style.display = "none";
  document.getElementById("step1Content").style.display = "none";
  document.getElementById("step2Content").style.display = "block";
  document.getElementById("backBtn").style.display = "inline-block";
  document.getElementById("nextBtn").textContent = "保存";
  document.getElementById("nextBtn").onclick = savePhoto;
  selectedSize = photo.ratio ?? "3:4";
  const selectedRadio = document.querySelector(`input[name="photoSize"][value="${ratioValue()}"]`);
  if (selectedRadio) {
    selectedRadio.checked = true;
  }
  document.getElementById("noteInput").value = photo.remark || "";
  document.getElementById("uploadArea").classList.add("has-image");
  document.getElementById("uploadArea").onclick = null;
  document.getElementById("uploadArea").classList.toggle("is-portrait", selectedSize === "3:4" && photo.media_type !== "video");
  document.getElementById("uploadArea").classList.toggle("is-landscape", selectedSize === "4:3" && photo.media_type !== "video");
  document.getElementById("uploadContent").innerHTML =
    photo.media_type === "video"
      ? `<video class="upload-preview" src="${photo.url}" controls preload="metadata"></video>`
      : `<img class="upload-preview" src="${photo.url}" alt="预览">`;
  document.getElementById("reselectRow").style.display = "flex";
  document.getElementById("zoomGroup").style.display = "none";
  document.getElementById("photoModal").classList.add("active");
}

async function savePhoto() {
  const note = document.getElementById("noteInput").value.trim();
  const nextButton = document.getElementById("nextBtn");
  const originalText = nextButton.textContent;
  nextButton.disabled = true;
  nextButton.textContent = "保存中...";

  try {
    if (!selectedFile && !editingPhoto) {
      throw new Error("请先选择照片或视频");
    }

    if (editingPhoto) {
      let patch = { remark: note, ratio: selectedSize };
      if (selectedFile) {
        const fileToUpload = await createCroppedImageFile();
        const storagePath = await uploadMedia(fileToUpload, albumId);
        patch = {
          ...patch,
          storage_path: storagePath,
          media_type: selectedMediaType === "video" ? "video" : "photo"
        };
      }
      await updatePhoto(editingPhoto.id, patch);
    } else {
      const fileToUpload = await createCroppedImageFile();
      const storagePath = await uploadMedia(fileToUpload, albumId);
      await insertPhoto({
        album_id: albumId,
        user_id: (await requireSession()).user.id,
        storage_path: storagePath,
        ratio: selectedSize,
        media_type: selectedMediaType === "video" ? "video" : "photo",
        remark: note
      });
    }

    closeModal();
    await renderAlbum();
  } catch (error) {
    window.alert(error.message || "保存失败");
  } finally {
    nextButton.disabled = false;
    nextButton.textContent = originalText;
  }
}

async function init() {
  await requireSession();
  albumId = getAlbumIdFromQuery();
  if (!albumId) {
    window.location.href = PAGE_URLS.albums;
    return;
  }

  window.goBack = function goBack() {
    window.location.href = `${PAGE_URLS.album}?album=${albumId}`;
  };
  window.saveAll = function saveAll() {
    saveDiaryMeta();
    window.location.href = `${PAGE_URLS.album}?album=${albumId}`;
  };
  window.editPhoto = editPhoto;
  window.deletePhoto = () => {};
  window.openAddModal = openAddModal;
  window.closeModal = closeModal;
  window.resetModal = resetModal;
  window.selectSize = selectSize;
  window.nextStep = nextStep;
  window.goToStep1 = goToStep1;
  window.triggerUpload = triggerUpload;
  window.handleFileSelect = handleFileSelect;
  window.savePhoto = savePhoto;
  window.updateCropZoom = function updateCropZoom(value) {
    cropperInstance?.setZoom(Number(value));
  };

  const storyInput = document.getElementById("storyInput");
  storyInput?.addEventListener("input", () => {
    updateStoryCounter();
    saveDiaryMeta();
  });

  await renderAlbum();
}

init();
