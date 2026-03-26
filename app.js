const installButton = document.getElementById("installButton");
const takePhotoButton = document.getElementById("takePhoto");
const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photosContainer = document.getElementById("photos");
const plateInput = document.getElementById("plateInput");
const notesInput = document.getElementById("notesInput");
const timeValue = document.getElementById("timeValue");
const coordsValue = document.getElementById("coordsValue");
const addressValue = document.getElementById("addressValue");
const operatorRadios = document.getElementById("operatorRadios");
const messagePreview = document.getElementById("messagePreview");
const sendButton = document.getElementById("sendButton");
const toast = document.getElementById("toast");

const operators = [
  { label: "Whoosh", email: "support@whoosh.bike" },
  { label: "Яндекс", email: "support.taxi@go.yandex.com" },
  { label: "Urent", email: "support@urent.ru" }
];

let deferredPrompt = null;
let stream = null;
const photos = [];

const state = {
  time: null,
  coords: null,
  address: null
};

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });
}

function renderOperators() {
  operatorRadios.innerHTML = "";
  operators.forEach((operator, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "radio-item";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "operator";
    input.value = operator.email;
    input.checked = index === 0;
    const span = document.createElement("span");
    span.textContent = `${operator.label} (${operator.email})`;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    operatorRadios.appendChild(wrapper);
  });
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = stream;
    takePhotoButton.disabled = false;
  } catch (error) {
    alert("Не удалось получить доступ к камере. Проверьте разрешения.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function addPhoto({ blob, url, name }) {
  photos.push({ blob, url, name });
  renderPhotos();
}

function removePhoto(index) {
  const [removed] = photos.splice(index, 1);
  if (removed?.url) {
    URL.revokeObjectURL(removed.url);
  }
  renderPhotos();
}

function renderPhotos() {
  photosContainer.innerHTML = "";
  photos.forEach((photo, index) => {
    const card = document.createElement("div");
    card.className = "photo-card";
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Удалить";
    btn.addEventListener("click", () => removePhoto(index));
    card.appendChild(img);
    card.appendChild(btn);
    photosContainer.appendChild(card);
  });
}

function capturePhoto() {
  if (!stream) return;
  const { videoWidth, videoHeight } = video;
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    addPhoto({ blob, url, name: `photo-${Date.now()}.jpg` });
  }, "image/jpeg", 0.9);
}

async function handleFileInput(event) {
  const files = Array.from(event.target.files || []);
  for (const file of files) {
    const url = URL.createObjectURL(file);
    addPhoto({ blob: file, url, name: file.name });
  }
  fileInput.value = "";
}

function updateTime() {
  const now = new Date();
  state.time = now;
  timeValue.textContent = now.toLocaleString("ru-RU");
}

async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    if (!response.ok) throw new Error("bad response");
    const data = await response.json();
    return data.display_name || "";
  } catch (error) {
    return "";
  }
}

function updateLocation() {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается на этом устройстве.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      state.coords = { latitude, longitude };
      coordsValue.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      const address = await reverseGeocode(latitude, longitude);
      state.address = address;
      addressValue.textContent = address || "Адрес не найден";
      buildMessage();
    },
    () => {
      alert("Не удалось получить координаты. Проверьте разрешения.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function getSelectedOperator() {
  const selected = operatorRadios.querySelector("input[name='operator']:checked");
  return selected ? selected.value : operators[0].email;
}

function buildMessage() {
  updateTime();
  const plate = plateInput.value.trim();
  const notes = notesInput.value.trim();
  const address = state.address || "(адрес не получен)";
  const coords = state.coords
    ? `${state.coords.latitude.toFixed(6)}, ${state.coords.longitude.toFixed(6)}`
    : "(координаты не получены)";
  const time = state.time ? state.time.toLocaleString("ru-RU") : "(время не получено)";

  const lines = [
    "Здравствуйте!",
    "Сообщаю о нарушении правил парковки самоката.",
    `Адрес: ${address}`,
    `Координаты: ${coords}`,
    `Время: ${time}`,
    `Номер самоката/госномер: ${plate}`
  ];

  if (notes) {
    lines.push(`Комментарий: ${notes}`);
  }

  lines.push("Фотофиксация во вложении.");
  messagePreview.value = lines.join("\n");
  return messagePreview.value;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toast._timeoutId);
  toast._timeoutId = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

async function copyRecipientToClipboard(email) {
  if (!navigator.clipboard) {
    showToast("Не удалось скопировать email: нет доступа к буферу.");
    return;
  }
  try {
    await navigator.clipboard.writeText(email);
    showToast(`Email скопирован: ${email}`);
  } catch (error) {
    showToast("Не удалось скопировать email. Проверьте разрешения.");
  }
}

async function sendReport() {
  const message = buildMessage();
  const subject = "Жалоба на парковку самоката";
  const operatorEmail = getSelectedOperator();

  copyRecipientToClipboard(operatorEmail);

  if (navigator.canShare && navigator.share && photos.length) {
    try {
      const files = photos.map((photo) => new File([photo.blob], photo.name, { type: photo.blob.type || "image/jpeg" }));
      await navigator.share({
        title: subject,
        text: message,
        files
      });
      return;
    } catch (error) {
      // fallback to mailto below
    }
  }

  const mailto = `mailto:${operatorEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    message
  )}`;
  window.location.href = mailto;
}

function setupEventListeners() {
  takePhotoButton.addEventListener("click", capturePhoto);
  fileInput.addEventListener("change", handleFileInput);
  sendButton.addEventListener("click", sendReport);
  plateInput.addEventListener("input", buildMessage);
  notesInput.addEventListener("input", buildMessage);
  operatorRadios.addEventListener("change", buildMessage);

  window.addEventListener("beforeunload", stopCamera);
}

updateTime();
renderOperators();
setupEventListeners();
setupInstallPrompt();
registerServiceWorker();
startCamera();
updateLocation();
buildMessage();