import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.__BAOBEI_CONFIG__ ?? {};

export const supabase = createClient(config.supabaseUrl ?? "", config.supabaseAnonKey ?? "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export const PAGE_URLS = {
  login: "登录页-最终版.html",
  register: "注册页.html",
  albums: "目录页.html",
  album: "相册页.html",
  albumEdit: "相册页-编辑态.html"
};

export function isConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && !String(config.supabaseUrl).includes("your-project"));
}

export function showMessage(element, message, type = "error") {
  if (!element) return;
  element.textContent = message;
  element.style.color = type === "success" ? "#5a7a2f" : "#b65b52";
  element.style.display = message ? "block" : "none";
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = PAGE_URLS.login;
    return null;
  }
  return session;
}

export function getAlbumIdFromQuery() {
  return new URLSearchParams(window.location.search).get("album");
}

export async function fetchCurrentProfile() {
  const session = await requireSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,email,baby_nickname,baby_birth_date")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function loginByNickname(nickname, password) {
  const { data: nicknameLookup, error: nicknameError } = await supabase.rpc("get_login_email", {
    nickname_input: nickname
  });
  if (nicknameError) throw nicknameError;

  const email = nicknameLookup?.[0]?.email;
  if (!email) {
    throw new Error("未找到对应账号昵称");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function registerAccount({ nickname, email, password }) {
  const { data: conflictData, error: conflictError } = await supabase.rpc("check_profile_conflict", {
    nickname_input: nickname,
    email_input: email
  });
  if (conflictError) throw conflictError;

  const conflict = conflictData?.[0];
  if (conflict?.nickname_exists || conflict?.email_exists) {
    throw new Error("用户昵称或邮箱已存在，请更换后重试");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname
      }
    }
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = PAGE_URLS.login;
}

export async function fetchAlbums() {
  const session = await requireSession();
  if (!session) return [];

  const { data: albums, error: albumError } = await supabase
    .from("albums")
    .select("id,name,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });
  if (albumError) throw albumError;

  const albumIds = albums.map((album) => album.id);
  if (albumIds.length === 0) {
    return [];
  }

  const { data: photos, error: photoError } = await supabase
    .from("photos")
    .select("id,album_id,storage_path,media_type,created_at")
    .eq("user_id", session.user.id)
    .in("album_id", albumIds)
    .order("created_at", { ascending: true });

  if (photoError) throw photoError;

  return albums.map((album) => {
    const media = photos.filter((item) => item.album_id === album.id);
    const photoCount = media.filter((item) => item.media_type !== "video").length;
    const videoCount = media.filter((item) => item.media_type === "video").length;
    const cover = media[0] ?? null;
    return {
      ...album,
      media,
      photoCount,
      videoCount,
      coverUrl: cover ? getStorageUrl(cover.storage_path) : null
    };
  });
}

export async function createAlbum(name) {
  const session = await requireSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("albums")
    .insert({
      user_id: session.user.id,
      name
    })
    .select("id,name,created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAlbum(albumId, patch) {
  const { data, error } = await supabase
    .from("albums")
    .update(patch)
    .eq("id", albumId)
    .select("id,name,created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAlbum(albumId) {
  const { data, error } = await supabase
    .from("albums")
    .select("id,name,created_at")
    .eq("id", albumId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAlbumMedia(albumId) {
  const { data, error } = await supabase
    .from("photos")
    .select("id,album_id,user_id,storage_path,ratio,media_type,remark,created_at")
    .eq("album_id", albumId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((item) => ({
    ...item,
    url: getStorageUrl(item.storage_path)
  }));
}

export function getStorageUrl(storagePath) {
  if (!storagePath) return null;
  const { data } = supabase.storage.from("photos").getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadMedia(file, albumId) {
  const session = await requireSession();
  if (!session) return null;
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const storagePath = `${session.user.id}/${albumId}/${safeName}`;
  const { error } = await supabase.storage.from("photos").upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  return storagePath;
}

export async function removeStorageObject(storagePath) {
  if (!storagePath) return;
  const { error } = await supabase.storage.from("photos").remove([storagePath]);
  if (error) throw error;
}

export async function insertPhoto(record) {
  const { data, error } = await supabase
    .from("photos")
    .insert(record)
    .select("id,album_id,user_id,storage_path,ratio,media_type,remark,created_at")
    .single();
  if (error) throw error;
  return {
    ...data,
    url: getStorageUrl(data.storage_path)
  };
}

export async function updatePhoto(photoId, patch) {
  const { data, error } = await supabase
    .from("photos")
    .update(patch)
    .eq("id", photoId)
    .select("id,album_id,user_id,storage_path,ratio,media_type,remark,created_at")
    .single();
  if (error) throw error;
  return {
    ...data,
    url: getStorageUrl(data.storage_path)
  };
}

export async function deletePhoto(photo) {
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
  await removeStorageObject(photo.storage_path);
}

export function mediaSummary(photoCount, videoCount) {
  const chunks = [];
  if (photoCount > 0) chunks.push(`${photoCount}张照片`);
  if (videoCount > 0) chunks.push(`${videoCount}个视频`);
  if (chunks.length === 0) return "0张照片";
  return chunks.join(" & ");
}
