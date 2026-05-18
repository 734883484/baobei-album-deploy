import {
  deletePhoto,
  fetchAlbum,
  fetchAlbumMedia,
  formatDate,
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
let cropState = {
  baseHeight: 0,
  baseWidth: 0,
  dragging: false,
  imageNaturalHeight: 0,
  imageNaturalWidth: 0,
  lastX: 0,
  lastY: 0,
  offsetX: 0,
  offsetY: 0,
  zoom: 1
};
let albumId = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clearPreviewUrl() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }
}

function resetCropState() {
  cropState = {
    baseHeight: 0,
    baseWidth: 0,
    dragging: false,
    imageNaturalHeight: 0,
    imageNaturalWidth: 0,
    lastX: 0,
    lastY: 0,
    offsetX: 0,
    offsetY: 0,
    zoom: 1
  };
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

function applyCropTransform() {
  const image = document.getElementById("cropImage");
  if (!image) return;
  image.style.width = `${cropState.baseWidth}px`;
  image.style.height = `${cropState.baseHeight}px`;
  image.style.transform = `translate(-50%, -50%) translate(${cropState.offsetX}px, ${cropState.offsetY}px) scale(${cropState.zoom})`;
}

function setupCropImage() {
  const image = document.getElementById("cropImage");
  const viewport = document.getElementById("cropViewport");
  if (!image || !viewport) return;

  const rect = viewport.getBoundingClientRect();
  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || 1;
  const coverScale = Math.max(rect.width / naturalWidth, rect.height / naturalHeight);

  cropState.imageNaturalWidth = naturalWidth;
  cropState.imageNaturalHeight = naturalHeight;
  cropState.baseWidth = naturalWidth * coverScale;
  cropState.baseHeight = naturalHeight * coverScale;
  cropState.offsetX = 0;
  cropState.offsetY = 0;
  cropState.zoom = 1;

  const zoomInput = document.getElementById("zoomInput");
  if (zoomInput) {
    zoomInput.value = "1";
  }

  applyCropTransform();
}

function scheduleCropSetup() {
  requestAnimationFrame(() => {
    requestAnimationFrame(setupCropImage);
  });
}

function bindCropDrag() {
  const viewport = document.getElementById("cropViewport");
  if (!viewport) return;

  viewport.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    cropState.dragging = true;
    cropState.lastX = event.clientX;
    cropState.lastY = event.clientY;
    viewport.classList.add("is-dragging");
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers do not allow pointer capture during native image drags.
    }
  });

  window.addEventListener("pointermove", (event) => {
    if (!cropState.dragging) return;
    event.preventDefault();
    cropState.offsetX += event.clientX - cropState.lastX;
    cropState.offsetY += event.clientY - cropState.lastY;
    cropState.lastX = event.clientX;
    cropState.lastY = event.clientY;
    applyCropTransform();
  });

  window.addEventListener("pointerup", () => {
    cropState.dragging = false;
    viewport.classList.remove("is-dragging");
  });

  window.addEventListener("pointercancel", () => {
    cropState.dragging = false;
    viewport.classList.remove("is-dragging");
  });
}

async function createCroppedImageFile() {
  if (!selectedFile || selectedMediaType === "video") return selectedFile;

  const viewport = document.getElementById("cropViewport");
  const image = document.getElementById("cropImage");
  if (!viewport || !image || !cropState.baseWidth || !cropState.baseHeight) {
    return selectedFile;
  }

  const outputWidth = selectedSize === "3:4" ? 300 : 400;
  const outputHeight = selectedSize === "3:4" ? 400 : 300;
  const rect = viewport.getBoundingClientRect();
  const scale = cropState.baseWidth / cropState.imageNaturalWidth;
  const renderedWidth = cropState.baseWidth * cropState.zoom;
  const renderedHeight = cropState.baseHeight * cropState.zoom;
  const imageLeft = rect.width / 2 - renderedWidth / 2 + cropState.offsetX;
  const imageTop = rect.height / 2 - renderedHeight / 2 + cropState.offsetY;
  const sourceX = Math.max(0, (0 - imageLeft) / (scale * cropState.zoom));
  const sourceY = Math.max(0, (0 - imageTop) / (scale * cropState.zoom));
  const sourceWidth = Math.min(cropState.imageNaturalWidth - sourceX, rect.width / (scale * cropState.zoom));
  const sourceHeight = Math.min(cropState.imageNaturalHeight - sourceY, rect.height / (scale * cropState.zoom));

  const bitmap = await createImageBitmap(selectedFile);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

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

  clearPreviewUrl();
  previewUrl = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    uploadContent.innerHTML = `<video class="upload-preview" src="${previewUrl}" controls preload="metadata"></video>`;
  } else {
    uploadContent.innerHTML = `
      <div class="upload-cropper-wrap" id="cropViewport">
        <img id="cropImage" src="${previewUrl}" alt="预览" draggable="false">
      </div>
    `;
    const image = document.getElementById("cropImage");
    image.ondragstart = () => false;
    image.addEventListener("load", scheduleCropSetup, { once: true });
    if (image.complete) {
      scheduleCropSetup();
    }
    bindCropDrag();
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
  resetCropState();
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
  resetCropState();
  previewUpload(file);
}

function renderCard(item) {
  const sizeClass = item.ratio === "4:3" ? "size-4-3" : "size-3-4";
  const mediaTag =
    item.media_type === "video"
      ? `<video src="${item.url}" controls preload="metadata"></video>`
      : `<img src="${item.url}" alt="照片">`;

  return `
    <div class="photo-card ${sizeClass}" data-id="${item.id}">
      <div class="photo-actions">
        <button class="photo-action-btn edit-action" data-action="edit" title="编辑">编辑</button>
        <button class="photo-action-btn delete-action" data-action="delete" title="删除">删除</button>
      </div>
      <div class="photo-image">${mediaTag}</div>
      <div class="photo-note">
        <span class="photo-note-text">${item.remark || ""}</span>
      </div>
    </div>
  `;
}

async function renderAlbum() {
  const album = await fetchAlbum(albumId);
  const media = await fetchAlbumMedia(albumId);
  document.querySelector(".album-title").textContent = album.name;
  document.querySelector(".album-date").textContent = formatDate(album.created_at);

  const grid = document.querySelector(".photos-grid");
  grid.innerHTML = media.map(renderCard).join("") + `
    <button class="add-photo-card" id="addCard" type="button">
      <div class="add-icon">+</div>
      <span class="add-text">添加照片或视频</span>
    </button>
  `;

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
  resetCropState();
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
    cropState.zoom = Number(value);
    applyCropTransform();
  };

  await renderAlbum();
}

init();
