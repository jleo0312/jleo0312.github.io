const PAGE_SIZE = 9;
const DB_NAME = "composite-studio-log";
const STORE_NAME = "jobs";
let db;
let jobs = [];
let activeJobId = null;
let page = 1;

const RESIN_MEASURED_PROCESSES = new Set(["Wet layup", "Resin infusion", "Forged carbon"]);

const $ = (sel) => document.querySelector(sel);
const jobGrid = $("#jobGrid");
const dialog = $("#jobDialog");

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(job) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(job);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function sortJobs() {
  jobs.sort((a, b) => {
    const da = a.date || "";
    const dbb = b.date || "";
    if (da !== dbb) return dbb.localeCompare(da);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function formatDate(value) {
  if (!value) return "No date";
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric"
  }).format(new Date(y, m - 1, d));
}

function processUsesMeasuredResin(process) {
  return RESIN_MEASURED_PROCESSES.has(process);
}

function resinDelta(job) {
  if (!processUsesMeasuredResin(job.process)) return null;
  const target = Number(job.targetResin);
  const actual = Number(job.actualResin);
  if (!(target > 0) || !(actual >= 0)) return null;
  const grams = actual - target;
  const percent = (grams / target) * 100;
  return { grams, percent };
}

function firstPhoto(job) {
  return (job.blocks || []).find(b => b.type === "photo" && b.dataUrl);
}

function renderGrid() {
  sortJobs();
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * PAGE_SIZE;
  const visible = jobs.slice(start, start + PAGE_SIZE);

  jobGrid.innerHTML = "";

  visible.forEach(job => {
    const frag = $("#jobCardTemplate").content.cloneNode(true);
    const card = frag.querySelector(".job-card");
    const image = frag.querySelector(".card-image");
    const date = frag.querySelector(".card-date");
    const title = frag.querySelector(".card-title");
    const meta = frag.querySelector(".card-meta");

    const photo = firstPhoto(job);
    if (photo) {
      image.style.backgroundImage = `url("${photo.dataUrl}")`;
    } else {
      image.classList.add("no-photo");
    }

    date.textContent = formatDate(job.date);
    title.textContent = job.title?.trim() || "Untitled job";

    if (job.process) {
      const chip = document.createElement("span");
      chip.className = "meta-chip";
      chip.textContent = job.process;
      meta.appendChild(chip);
    }

    const delta = resinDelta(job);
    if (delta) {
      const chip = document.createElement("span");
      chip.className = "meta-chip " + (delta.grams > 0 ? "over" : delta.grams < 0 ? "under" : "");
      const sign = delta.percent > 0 ? "+" : "";
      chip.textContent = `Resin ${sign}${delta.percent.toFixed(0)}%`;
      meta.appendChild(chip);
    }

    card.addEventListener("click", () => openJob(job.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openJob(job.id);
      }
    });
    jobGrid.appendChild(frag);
  });

  if (visible.length < PAGE_SIZE && page === totalPages) {
    const add = document.createElement("div");
    add.className = "empty-grid-card";
    add.innerHTML = '<button type="button"><strong>+ Add a job</strong><span>Start a new manufacturing record</span></button>';
    add.querySelector("button").addEventListener("click", createJob);
    jobGrid.appendChild(add);
  }

  $("#jobCount").textContent = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`;
  $("#pageLabel").textContent = `Page ${page} of ${totalPages}`;
  $("#prevPage").disabled = page <= 1;
  $("#nextPage").disabled = page >= totalPages;
}

function getActiveJob() {
  return jobs.find(j => j.id === activeJobId);
}

function normalizeLegacyProcess(job) {
  if (job.process === "Compression molding") job.process = "Forged carbon";
  if (job.process === "Vacuum bagging") job.process = "";
}

function updateResinVisibility(job) {
  const show = processUsesMeasuredResin(job?.process);
  $("#targetResinField").hidden = !show;
  $("#actualResinField").hidden = !show;
  if (!show) {
    $("#resinResult").hidden = true;
    $("#resinResult").innerHTML = "";
  }
}

async function createJob() {
  const job = {
    id: uid(),
    date: todayISO(),
    title: "",
    process: "",
    targetResin: "",
    actualResin: "",
    blocks: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  jobs.push(job);
  await idbPut(job);
  renderGrid();
  openJob(job.id);
}

function openJob(id) {
  activeJobId = id;
  const job = getActiveJob();
  if (!job) return;
  normalizeLegacyProcess(job);

  $("#jobTitle").value = job.title || "";
  $("#jobDate").value = job.date || "";
  $("#jobProcess").value = job.process || "";
  $("#targetResin").value = job.targetResin ?? "";
  $("#actualResin").value = job.actualResin ?? "";
  updateResinVisibility(job);
  renderResinResult(job);
  renderBlocks(job);
  dialog.showModal();
  setTimeout(() => {
    if (!job.title) $("#jobTitle").focus();
  }, 80);
}

function updateJobFromFields() {
  const job = getActiveJob();
  if (!job) return;
  job.title = $("#jobTitle").value;
  job.date = $("#jobDate").value;
  job.process = $("#jobProcess").value;
  updateResinVisibility(job);
  job.targetResin = $("#targetResin").value;
  job.actualResin = $("#actualResin").value;
  job.updatedAt = Date.now();
  renderResinResult(job);
  saveJob(job);
}

let saveTimer;
function saveJob(job) {
  $("#saveStatus").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await idbPut(job);
    $("#saveStatus").textContent = "Saved automatically";
    renderGrid();
  }, 250);
}

function renderResinResult(job) {
  const result = $("#resinResult");
  const delta = resinDelta(job);
  if (!delta) {
    result.hidden = true;
    result.innerHTML = "";
    return;
  }

  result.hidden = false;
  const absG = Math.abs(delta.grams).toFixed(1);
  const absP = Math.abs(delta.percent).toFixed(1);

  if (Math.abs(delta.grams) < 0.05) {
    result.innerHTML = "<strong>On target.</strong> Actual resin matches the planned amount.";
  } else if (delta.grams > 0) {
    result.innerHTML = `<strong>${absG} g over target (${absP}%).</strong> Record why below so the next job can be tighter.`;
  } else {
    result.innerHTML = `<strong>${absG} g under target (${absP}%).</strong> Note whether the part still achieved full wet-out / fill.`;
  }
}

function renderBlocks(job) {
  const wrap = $("#blocks");
  wrap.innerHTML = "";
  const blocks = job.blocks || [];
  $("#emptyBlocks").hidden = blocks.length > 0;

  blocks.forEach(block => {
    if (block.type === "text") {
      const frag = $("#textBlockTemplate").content.cloneNode(true);
      const node = frag.querySelector(".note-block");
      const heading = frag.querySelector(".block-heading");
      const text = frag.querySelector(".block-text");

      heading.value = block.heading || "";
      text.value = block.text || "";

      heading.addEventListener("input", () => {
        block.heading = heading.value;
        job.updatedAt = Date.now();
        saveJob(job);
      });
      text.addEventListener("input", () => {
        block.text = text.value;
        job.updatedAt = Date.now();
        saveJob(job);
      });
      frag.querySelector(".remove-block").addEventListener("click", () => removeBlock(job, block.id));
      wrap.appendChild(frag);
    }

    if (block.type === "photo") {
      const frag = $("#photoBlockTemplate").content.cloneNode(true);
      const img = frag.querySelector(".block-photo");
      const caption = frag.querySelector(".photo-caption");
      img.src = block.dataUrl;
      img.alt = block.caption || "Job photo";
      caption.value = block.caption || "";
      caption.addEventListener("input", () => {
        block.caption = caption.value;
        img.alt = block.caption || "Job photo";
        job.updatedAt = Date.now();
        saveJob(job);
      });
      frag.querySelector(".remove-block").addEventListener("click", () => removeBlock(job, block.id));
      wrap.appendChild(frag);
    }
  });
}

function addTextBlock() {
  const job = getActiveJob();
  if (!job) return;
  job.blocks.push({ id: uid(), type: "text", heading: "", text: "" });
  job.updatedAt = Date.now();
  renderBlocks(job);
  saveJob(job);
  const areas = $("#blocks").querySelectorAll(".block-text");
  areas[areas.length - 1]?.focus();
}

function removeBlock(job, blockId) {
  job.blocks = job.blocks.filter(b => b.id !== blockId);
  job.updatedAt = Date.now();
  renderBlocks(job);
  saveJob(job);
}

function imageToDataURL(file, maxSide = 1800, quality = .84) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

async function addPhotos(files) {
  const job = getActiveJob();
  if (!job || !files?.length) return;
  $("#saveStatus").textContent = "Adding photo…";

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await imageToDataURL(file);
    job.blocks.push({
      id: uid(),
      type: "photo",
      dataUrl,
      caption: ""
    });
  }

  job.updatedAt = Date.now();
  renderBlocks(job);
  await idbPut(job);
  $("#saveStatus").textContent = "Saved automatically";
  renderGrid();
}

async function deleteActiveJob() {
  const job = getActiveJob();
  if (!job) return;
  const label = job.title?.trim() || "this job";
  if (!confirm(`Delete "${label}"? This cannot be undone unless you have an exported backup.`)) return;
  await idbDelete(job.id);
  jobs = jobs.filter(j => j.id !== job.id);
  activeJobId = null;
  dialog.close();
  renderGrid();
}

function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBackup() {
  const stamp = todayISO();
  downloadJSON(`composite-studio-log-${stamp}.json`, {
    version: 1,
    exportedAt: new Date().toISOString(),
    jobs
  });
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.jobs)) throw new Error("Invalid backup");
    if (!confirm(`Import ${data.jobs.length} jobs? Existing jobs with the same IDs will be replaced.`)) return;

    const map = new Map(jobs.map(j => [j.id, j]));
    for (const job of data.jobs) {
      if (!job.id) job.id = uid();
      if (!Array.isArray(job.blocks)) job.blocks = [];
      map.set(job.id, job);
      await idbPut(job);
    }
    jobs = [...map.values()];
    page = 1;
    renderGrid();
  } catch (err) {
    alert("That backup file could not be imported.");
    console.error(err);
  }
}

["jobTitle", "jobDate", "jobProcess", "targetResin", "actualResin"].forEach(id => {
  $("#" + id).addEventListener("input", updateJobFromFields);
  $("#" + id).addEventListener("change", updateJobFromFields);
});

$("#newJobBtn").addEventListener("click", createJob);
$("#addTextBtn").addEventListener("click", addTextBlock);
$("#photoInput").addEventListener("change", async e => {
  await addPhotos([...e.target.files]);
  e.target.value = "";
});
$("#deleteJobBtn").addEventListener("click", deleteActiveJob);
$("#exportBtn").addEventListener("click", exportBackup);
$("#importInput").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (file) await importBackup(file);
  e.target.value = "";
});
$("#prevPage").addEventListener("click", () => {
  if (page > 1) { page--; renderGrid(); window.scrollTo({ top: 0, behavior: "smooth" }); }
});
$("#nextPage").addEventListener("click", () => {
  const total = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  if (page < total) { page++; renderGrid(); window.scrollTo({ top: 0, behavior: "smooth" }); }
});
dialog.addEventListener("close", () => {
  activeJobId = null;
  renderGrid();
});

(async function init() {
  try {
    db = await openDB();
    jobs = await idbGetAll();
    let migrated = false;
    for (const job of jobs) {
      const before = job.process;
      normalizeLegacyProcess(job);
      if (job.process !== before) {
        migrated = true;
        await idbPut(job);
      }
    }
    renderGrid();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = "<main style='padding:40px;font-family:sans-serif'><h1>Could not open the job log.</h1><p>Your browser may have private storage disabled.</p></main>";
  }
})();