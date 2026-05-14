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
let albumId = null;

function previewUpload(file) {
  const uploadArea = document.getElementById("uploadArea");
  const uploadContent = document.getElementById("uploadContent");
  uploadArea.classList.add("has-image");

  const previewUrl = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    uploadContent.innerHTML = `<video src="${previewUrl}" controls preload="metadata"></video>`;
  } else {
    uploadContent.innerHTML = `<img src="${previewUrl}" alt="预览">`;
  }
}

function resetModal() {
  selectedSize = "3:4";
  editingPhoto = null;
  selectedFile = null;
  document.getElementById("modalTitle").textContent = "添加照片";
  document.getElementById("stepsIndicator").style.display = "flex";
  document.getElementById("step1Content").style.display = "block";
  document.getElementById("step2Content").style.display = "none";
  document.getElementById("nextBtn").textContent = "下一步";
  document.getElementById("nextBtn").onclick = nextStep;
  document.getElementById("backBtn").style.display = "none";
  document.getElementById("noteInput").value = "";
  document.querySelector('input[name="photoSize"][value="3-4"]').checked = true;
  document.getElementById("uploadArea").classList.remove("has-image");
  document.getElementById("uploadContent").innerHTML = `
    <div class="upload-icon">📷</div>
    <div class="upload-text">点击上传照片</div>
    <div class="upload-hint" id="selectedSizeHint">已选：3:4 竖版</div>
  `;
  document.getElementById("fileInput").value = "";
}

function closeModal() {
  document.getElementById("photoModal").classList.remove("active");
  resetModal();
}

function selectSize(size) {
  selectedSize = size === "3-4" ? "3:4" : "4:3";
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
  const hint = document.getElementById("selectedSizeHint");
  if (hint) {
    hint.textContent = `已选：${selectedSize === "3:4" ? "3:4 竖版" : "4:3 横版"}`;
  }
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
  document.getElementById("photoModal").classList.add("active");
}

function triggerUpload() {
  document.getElementById("fileInput").click();
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  selectedFile = file;
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
        <button class="edit-btn" data-action="edit">编辑</button>
        <button class="delete-btn" data-action="delete">删除</button>
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
    <div class="photo-card add-card" id="addCard">
      <div class="add-icon">+</div>
      <div class="photo-note">新增照片和备注</div>
    </div>
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
  document.getElementById("modalTitle").textContent = "编辑照片";
  document.getElementById("stepsIndicator").style.display = "none";
  document.getElementById("step1Content").style.display = "none";
  document.getElementById("step2Content").style.display = "block";
  document.getElementById("backBtn").style.display = "none";
  document.getElementById("nextBtn").textContent = "保存";
  document.getElementById("nextBtn").onclick = savePhoto;
  selectedSize = photo.ratio ?? "3:4";
  document.getElementById("noteInput").value = photo.remark || "";
  document.getElementById("uploadArea").classList.add("has-image");
  document.getElementById("uploadContent").innerHTML =
    photo.media_type === "video"
      ? `<video src="${photo.url}" controls preload="metadata"></video>`
      : `<img src="${photo.url}" alt="预览">`;
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
        const storagePath = await uploadMedia(selectedFile, albumId);
        patch = {
          ...patch,
          storage_path: storagePath,
          media_type: selectedFile.type.startsWith("video/") ? "video" : "photo"
        };
      }
      await updatePhoto(editingPhoto.id, patch);
    } else {
      const storagePath = await uploadMedia(selectedFile, albumId);
      await insertPhoto({
        album_id: albumId,
        user_id: (await requireSession()).user.id,
        storage_path: storagePath,
        ratio: selectedSize,
        media_type: selectedFile.type.startsWith("video/") ? "video" : "photo",
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

  await renderAlbum();
}

init();
