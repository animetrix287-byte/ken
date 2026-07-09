const DB_NAME = "kaneki-dll-vault";
const STORE_NAME = "dlls";
const DB_VERSION = 1;

const form = document.querySelector("#uploadForm");
const fileInput = document.querySelector("#dllFile");
const titleInput = document.querySelector("#titleInput");
const noteInput = document.querySelector("#noteInput");
const dropZone = document.querySelector("#dropZone");
const fileHint = document.querySelector("#fileHint");
const entryList = document.querySelector("#entryList");
const entryTemplate = document.querySelector("#entryTemplate");
const entryCount = document.querySelector("#entryCount");
const totalSize = document.querySelector("#totalSize");
const lastUpload = document.querySelector("#lastUpload");
const storageStatus = document.querySelector("#storageStatus");
const searchInput = document.querySelector("#searchInput");
const clearSearch = document.querySelector("#clearSearch");
const bgCanvas = document.querySelector("#ghoulBg");

let db;
let entries = [];
let bgAnimation;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(mode = "readonly") {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function getAllEntries() {
  return new Promise((resolve, reject) => {
    const request = transaction().getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function addEntry(entry) {
  return new Promise((resolve, reject) => {
    const request = transaction("readwrite").add(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteEntry(id) {
  return new Promise((resolve, reject) => {
    const request = transaction("readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function isDll(file) {
  return Boolean(file && file.name.toLowerCase().endsWith(".dll"));
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function setStatus(message) {
  storageStatus.textContent = message;
}

function setSelectedFile(file) {
  if (!isDll(file)) {
    fileInput.value = "";
    fileHint.textContent = "Bitte eine Datei mit .dll auswaehlen.";
    setStatus("Falscher Typ");
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileHint.textContent = `${file.name} - ${formatBytes(file.size)}`;
  if (!titleInput.value.trim()) {
    titleInput.value = file.name;
  }
  setStatus("Ausgewaehlt");
}

function renderStats(list) {
  entryCount.textContent = String(list.length);
  totalSize.textContent = formatBytes(list.reduce((sum, entry) => sum + entry.size, 0));
  lastUpload.textContent = list[0] ? formatDate(list[0].createdAt) : "-";
}

function renderEntries() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const haystack = `${entry.title} ${entry.fileName} ${entry.note}`.toLowerCase();
    return haystack.includes(query);
  });

  entryList.replaceChildren();
  renderStats(entries);

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = query
      ? "Keine passende DLL gefunden."
      : "Noch nichts gespeichert. Lade deine erste DLL hoch.";
    entryList.append(empty);
    return;
  }

  filtered.forEach((entry) => {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = entry.id;
    node.querySelector("h3").textContent = entry.title || entry.fileName;
    node.querySelector(".entry__sub").textContent =
      `${entry.fileName} - ${formatBytes(entry.size)} - ${formatDate(entry.createdAt)}`;
    node.querySelector(".entry__note").textContent = entry.note || "Keine Beschreibung.";
    entryList.append(node);
  });
}

async function refreshEntries() {
  entries = await getAllEntries();
  entries.sort((a, b) => b.createdAt - a.createdAt);
  renderEntries();
}

function resetForm() {
  form.reset();
  fileHint.textContent = "Nur Dateien mit .dll werden angenommen.";
  setStatus("Bereit");
}

async function handleSubmit(event) {
  event.preventDefault();
  const file = fileInput.files[0];

  if (!isDll(file)) {
    setStatus("DLL fehlt");
    fileHint.textContent = "Waehle zuerst eine .dll Datei aus.";
    return;
  }

  setStatus("Speichere");

  await addEntry({
    title: titleInput.value.trim() || file.name,
    note: noteInput.value.trim(),
    fileName: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    blob: file,
    createdAt: Date.now(),
  });

  resetForm();
  await refreshEntries();
  setStatus("Gespeichert");
}

function download(entry) {
  const url = URL.createObjectURL(entry.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = entry.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  setSelectedFile(event.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => setSelectedFile(fileInput.files[0]));
form.addEventListener("submit", handleSubmit);
form.addEventListener("reset", () => setTimeout(resetForm, 0));
searchInput.addEventListener("input", renderEntries);
clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  renderEntries();
  searchInput.focus();
});

entryList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  const entryNode = event.target.closest(".entry");
  if (!button || !entryNode) return;

  const id = Number(entryNode.dataset.id);
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  if (button.dataset.action === "download") {
    download(entry);
  }

  if (button.dataset.action === "delete") {
    await deleteEntry(id);
    await refreshEntries();
    setStatus("Geloescht");
  }
});

async function start() {
  try {
    db = await openDatabase();
    await refreshEntries();
    setStatus("Bereit");
  } catch (error) {
    console.error(error);
    setStatus("Speicherfehler");
    entryList.innerHTML =
      '<div class="empty">Der Browser-Speicher konnte nicht geoeffnet werden.</div>';
  }
}

function startGhoulBackground() {
  if (!bgCanvas) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const context = bgCanvas.getContext("2d");
  const cityWindows = [];
  const tendrils = [];
  const rain = [];
  const sparks = [];
  let width = 0;
  let height = 0;
  let time = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    bgCanvas.width = Math.floor(width * ratio);
    bgCanvas.height = Math.floor(height * ratio);
    bgCanvas.style.width = `${width}px`;
    bgCanvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    cityWindows.length = 0;
    const buildingCount = Math.max(10, Math.floor(width / 92));
    for (let i = 0; i < buildingCount; i += 1) {
      const buildingWidth = 38 + Math.random() * 64;
      const buildingHeight = 90 + Math.random() * Math.min(240, height * 0.32);
      cityWindows.push({
        x: (i / buildingCount) * width + Math.random() * 30,
        y: height - buildingHeight,
        w: buildingWidth,
        h: buildingHeight,
        glow: Math.random(),
      });
    }

    tendrils.length = 0;
    const tendrilCount = Math.max(7, Math.floor(width / 170));
    for (let i = 0; i < tendrilCount; i += 1) {
      tendrils.push({
        startX: width * (0.54 + Math.random() * 0.45),
        startY: height * (0.2 + Math.random() * 0.54),
        length: 150 + Math.random() * 280,
        phase: Math.random() * Math.PI * 2,
        thickness: 1.2 + Math.random() * 2.5,
      });
    }

    rain.length = 0;
    const rainCount = reducedMotion ? 0 : Math.min(190, Math.floor((width * height) / 6200));
    for (let i = 0; i < rainCount; i += 1) {
      rain.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 9 + Math.random() * 14,
        length: 11 + Math.random() * 22,
        alpha: 0.06 + Math.random() * 0.12,
      });
    }

    sparks.length = 0;
    const sparkCount = reducedMotion ? 0 : Math.min(48, Math.floor(width / 18));
    for (let i = 0; i < sparkCount; i += 1) {
      sparks.push({
        x: width * (0.45 + Math.random() * 0.55),
        y: Math.random() * height,
        vx: -0.3 - Math.random() * 0.8,
        vy: -0.2 + Math.random() * 0.4,
        size: 0.7 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawCity() {
    context.save();
    context.fillStyle = "rgba(2, 3, 6, 0.86)";
    cityWindows.forEach((building) => {
      context.fillRect(building.x, building.y, building.w, building.h);
      context.fillStyle = `rgba(224, 23, 53, ${0.08 + building.glow * 0.16})`;
      for (let y = building.y + 14; y < height - 18; y += 18) {
        for (let x = building.x + 8; x < building.x + building.w - 6; x += 16) {
          if ((x + y + Math.floor(time * 20)) % 5 < 2) {
            context.fillRect(x, y, 4, 7);
          }
        }
      }
      context.fillStyle = "rgba(2, 3, 6, 0.86)";
    });
    context.restore();
  }

  function drawTendrils() {
    tendrils.forEach((tendril) => {
      const gradient = context.createLinearGradient(tendril.startX, tendril.startY, tendril.startX - tendril.length, tendril.startY);
      gradient.addColorStop(0, "rgba(255, 41, 70, 0.8)");
      gradient.addColorStop(0.5, "rgba(158, 8, 30, 0.44)");
      gradient.addColorStop(1, "rgba(224, 23, 53, 0)");

      context.beginPath();
      context.moveTo(tendril.startX, tendril.startY);
      for (let i = 1; i <= 5; i += 1) {
        const progress = i / 5;
        const x = tendril.startX - tendril.length * progress;
        const sway = Math.sin(time * 1.4 + tendril.phase + progress * 4.2) * 42;
        const y = tendril.startY + sway + (progress - 0.5) * 80;
        context.lineTo(x, y);
      }
      context.strokeStyle = gradient;
      context.lineWidth = tendril.thickness;
      context.shadowColor = "rgba(224, 23, 53, 0.7)";
      context.shadowBlur = 16;
      context.stroke();
      context.shadowBlur = 0;
    });
  }

  function drawRain() {
    context.strokeStyle = "rgba(255, 248, 239, 0.11)";
    rain.forEach((drop) => {
      context.globalAlpha = drop.alpha;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - 7, drop.y + drop.length);
      context.stroke();
      drop.x -= 0.9;
      drop.y += drop.speed;
      if (drop.y > height + 30) {
        drop.x = Math.random() * width;
        drop.y = -30;
      }
    });
    context.globalAlpha = 1;
  }

  function drawSparks() {
    sparks.forEach((spark) => {
      const alpha = 0.18 + Math.sin(time * 2 + spark.phase) * 0.12;
      context.fillStyle = `rgba(255, 35, 68, ${alpha})`;
      context.beginPath();
      context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      context.fill();
      spark.x += spark.vx;
      spark.y += spark.vy;
      if (spark.x < -20 || spark.y < -20 || spark.y > height + 20) {
        spark.x = width * (0.58 + Math.random() * 0.42);
        spark.y = Math.random() * height;
      }
    });
  }

  function draw() {
    time += reducedMotion ? 0.005 : 0.016;
    context.clearRect(0, 0, width, height);

    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#050507");
    sky.addColorStop(0.52, "#0c0d12");
    sky.addColorStop(1, "#030304");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(224, 23, 53, 0.08)";
    context.beginPath();
    context.arc(width * 0.76, height * 0.28, Math.min(width, height) * 0.3, 0, Math.PI * 2);
    context.fill();

    drawCity();
    drawTendrils();
    drawSparks();
    drawRain();

    if (!reducedMotion) {
      bgAnimation = requestAnimationFrame(draw);
    }
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
}

startGhoulBackground();
start();
