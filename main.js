import { FFmpeg } from "./ffmpeg/index.js";
import { fetchFile, toBlobURL } from "./ffmpeg/util.js";

const CORE_VERSION = "0.12.10";
const CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_DURATION = 30;
const TARGET_GIF_SIZE = 20 * 1024 * 1024;
const MIN_BOX = 240;
const MIN_FPS = 10;
const COLOR_STEPS = [256, 224, 192, 160, 128, 96, 64, 48, 32, 24, 16];
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mpeg", "mpg"]);

const els = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  browseBtn: document.getElementById("browseBtn"),
  clearBtn: document.getElementById("clearBtn"),
  convertBtn: document.getElementById("convertBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  downloadZipBtn: document.getElementById("downloadZipBtn"),
  boxRange: document.getElementById("boxRange"),
  fpsRange: document.getElementById("fpsRange"),
  boxValue: document.getElementById("boxValue"),
  fpsValue: document.getElementById("fpsValue"),
  fileList: document.getElementById("fileList"),
  resultsList: document.getElementById("resultsList"),
  log: document.getElementById("log"),
  progressBar: document.getElementById("progressBar"),
  progressDetail: document.getElementById("progressDetail"),
  statusText: document.getElementById("statusText"),
  summaryText: document.getElementById("summaryText"),
  fileCount: document.getElementById("fileCount"),
  validCount: document.getElementById("validCount"),
  zipState: document.getElementById("zipState"),
};

const state = {
  files: [],
  results: [],
  ffmpeg: null,
  ffmpegReady: false,
  processing: false,
  loadPromise: null,
  activeProgress: 0,
  activeIndex: 0,
  activeTotal: 0,
  cancelRequested: false,
};

function createFfmpegClient() {
  const client = new FFmpeg();
  client.on("progress", ({ progress }) => {
    state.activeProgress = progress ?? 0;
    updateProgress();
  });
  return client;
}

state.ffmpeg = createFfmpegClient();

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(2)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "-";
  return `${seconds.toFixed(1)}s`;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "video";
}

function evenNumber(value) {
  const rounded = Math.max(2, Math.floor(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextColorStep(current) {
  for (const candidate of COLOR_STEPS) {
    if (candidate < current) return candidate;
  }
  return current;
}

function safeFileExtension(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}

function isLikelyVideo(file) {
  return file.type.startsWith("video/") || safeFileExtension(file.name);
}

function createFileId(file) {
  const fingerprint = `${file.name}|${file.size}|${file.lastModified}`;
  return fingerprint;
}

function appendLog() {}

function setStatus(message) {
  els.statusText.textContent = message;
}

function updateSummary() {
  const total = state.files.length;
  const valid = state.files.filter((entry) => entry.valid).length;
  els.fileCount.textContent = String(total);
  els.validCount.textContent = String(valid);
  els.summaryText.textContent = `선택 파일 ${total}개 · 변환 가능 ${valid}개`;
  if (!state.processing) {
    els.zipState.textContent = state.results.some((item) => item.success) ? "생성 가능" : "대기";
  }
}

function updateProgress() {
  if (!state.processing) return;

  const overall =
    state.activeTotal === 0
      ? 0
      : (state.activeIndex + state.activeProgress) / state.activeTotal;

  const percent = Math.max(0, Math.min(100, overall * 100));
  els.progressBar.value = percent;
  els.progressDetail.textContent = `${Math.round(percent)}%`;
}

function setControlsDisabled(disabled) {
  els.convertBtn.disabled = disabled;
  els.cancelBtn.disabled = !disabled;
  els.clearBtn.disabled = disabled;
  els.browseBtn.disabled = disabled;
  els.downloadZipBtn.disabled = disabled || !state.results.some((item) => item.success);
}

function makeEmptyState(message) {
  return `
    <div class="empty fade-in">
      ${message}
    </div>
  `;
}

function renderFiles() {
  if (state.files.length === 0) {
    els.fileList.innerHTML = makeEmptyState("아직 등록된 파일이 없습니다. 영상을 추가해 주세요.");
    updateSummary();
    return;
  }

  const html = state.files
    .map((entry) => {
      const statusClass =
        entry.status === "완료" || entry.status === "대기"
          ? "ok"
          : entry.status === "변환 중" || entry.status === "검사 중"
            ? "warn"
            : entry.valid
              ? "ok"
              : "bad";
      const reason = entry.reason ? `<p class="reason">${entry.reason}</p>` : "";
      const actions = `
        <div class="card-actions">
          <button class="button subtle" data-remove="${entry.id}">삭제</button>
        </div>
      `;

      return `
        <article class="item-card fade-in">
          <div class="item-top">
            <div class="item-title">
              <strong>${entry.file.name}</strong>
              <span>${formatBytes(entry.file.size)} · ${entry.meta ? `${formatDuration(entry.meta.duration)} · ${entry.meta.width}×${entry.meta.height}` : "메타데이터 확인 중"}</span>
            </div>
            <span class="badge ${statusClass}">${entry.status}</span>
          </div>
          <div class="item-grid">
            <div class="kv">
              <span>파일 크기</span>
              <strong>${formatBytes(entry.file.size)}</strong>
            </div>
            <div class="kv">
              <span>길이</span>
              <strong>${entry.meta ? formatDuration(entry.meta.duration) : "-"}</strong>
            </div>
            <div class="kv">
              <span>해상도</span>
              <strong>${entry.meta ? `${entry.meta.width}×${entry.meta.height}` : "-"}</strong>
            </div>
            <div class="kv">
              <span>결과</span>
              <strong>${entry.output ? formatBytes(entry.output.size) : "-"}</strong>
            </div>
          </div>
          ${reason}
          ${actions}
        </article>
      `;
    })
    .join("");

  els.fileList.innerHTML = html;
  updateSummary();
}

function renderResults() {
  const successItems = state.results.filter((item) => item.success);

  if (successItems.length === 0) {
    els.resultsList.innerHTML = makeEmptyState("아직 완성된 GIF가 없습니다. 변환을 시작해 주세요.");
    els.downloadZipBtn.disabled = true;
    updateSummary();
    return;
  }

  els.downloadZipBtn.disabled = state.processing || successItems.length === 0;
  els.resultsList.innerHTML = successItems
    .map((item) => {
      const objectUrl = item.url;
      return `
        <article class="item-card fade-in">
          <div class="item-top">
            <div class="item-title">
              <strong>${item.outputName}</strong>
              <span>${formatBytes(item.size)} · 원본 ${item.sourceName}</span>
            </div>
            <span class="badge ok">완료</span>
          </div>
          <div class="item-grid">
            <div class="kv">
              <span>최종 용량</span>
              <strong>${formatBytes(item.size)}</strong>
            </div>
            <div class="kv">
              <span>가로 폭</span>
              <strong>${item.width}px</strong>
            </div>
            <div class="kv">
              <span>FPS</span>
              <strong>${item.fps}</strong>
            </div>
            <div class="kv">
              <span>시도</span>
              <strong>${item.attempts}회</strong>
            </div>
          </div>
          <div class="card-actions">
            <a class="button accent" href="${objectUrl}" download="${item.outputName}">개별 다운로드</a>
          </div>
        </article>
      `;
    })
    .join("");
  updateSummary();
}

function revokeResultUrls() {
  for (const result of state.results) {
    if (result.url) {
      URL.revokeObjectURL(result.url);
    }
  }
}

function resetWorkspace() {
  state.files = [];
  revokeResultUrls();
  state.results = [];
  state.activeProgress = 0;
  state.activeIndex = 0;
  state.activeTotal = 0;
  state.cancelRequested = false;
  setStatus("대기 중");
  els.progressBar.value = 0;
  els.progressDetail.textContent = "0%";
  els.fileInput.value = "";
  renderFiles();
  renderResults();
  appendLog("작업 영역을 초기화했습니다.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      resolve({ duration, width, height });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("영상 메타데이터를 읽을 수 없습니다."));
    };

    video.src = objectUrl;
  });
}

async function inspectEntry(entry) {
  try {
    const meta = await getVideoMetadata(entry.file);
    entry.meta = meta;
    const issues = [];

    if (!isLikelyVideo(entry.file)) {
      issues.push("영상 파일 형식이 아닙니다.");
    }
    if (entry.file.size > MAX_FILE_SIZE) {
      issues.push(`100MB 제한을 넘었습니다. 현재 ${formatBytes(entry.file.size)}입니다.`);
    }
    if (meta.duration > MAX_DURATION) {
      issues.push(`길이가 ${MAX_DURATION}초를 넘습니다. 현재 ${formatDuration(meta.duration)}입니다.`);
    }

    if (issues.length === 0) {
      entry.valid = true;
      entry.status = "대기";
      entry.reason = meta.duration < 10 ? "짧은 영상은 되지만 10~30초 구간이 가장 안정적입니다." : "";
    } else {
      entry.valid = false;
      entry.status = "제한 초과";
      entry.reason = issues.join(" ");
    }
  } catch (error) {
    entry.meta = null;
    entry.valid = false;
    entry.status = "읽기 실패";
    entry.reason = error instanceof Error ? error.message : "파일을 읽는 중 오류가 발생했습니다.";
  }

  renderFiles();
  renderResults();
}

function addFiles(fileList) {
  const incoming = Array.from(fileList);
  const existingIds = new Set(state.files.map((entry) => entry.id));

  for (const file of incoming) {
    const id = createFileId(file);
    if (existingIds.has(id)) {
      appendLog(`[중복 건너뜀] ${file.name}`);
      continue;
    }

    const entry = {
      id,
      file,
      meta: null,
      valid: false,
      status: "검사 중",
      reason: "",
      output: null,
      validationPromise: null,
    };

    state.files.push(entry);
    existingIds.add(id);
    renderFiles();
    entry.validationPromise = inspectEntry(entry);
    appendLog(`[추가] ${file.name}`);
  }
}

function removeEntry(id) {
  if (state.processing) return;
  const index = state.files.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const [removed] = state.files.splice(index, 1);
  if (removed?.output?.url) {
    URL.revokeObjectURL(removed.output.url);
  }
  appendLog(`[삭제] ${removed.file.name}`);
  renderFiles();
  renderResults();
}

function buildFilterComplex(width, fps, colors) {
  return [
    `[0:v]fps=${fps},scale='min(iw,${width})':-2:flags=lanczos,setsar=1,split[s0][s1]`,
    `[s0]palettegen=stats_mode=diff:max_colors=${colors}[p]`,
    `[s1][p]paletteuse=dither=sierra2_4a[out]`,
  ].join(";");
}

function nextAttempt(settings, currentSize) {
  if (currentSize <= TARGET_GIF_SIZE) return settings;

  const ratio = TARGET_GIF_SIZE / currentSize;
  const widthFactor = clamp(Math.pow(ratio, 0.35), 0.6, 0.95);
  const fpsFactor = clamp(Math.pow(ratio, 0.2), 0.8, 0.98);

  let nextWidth = evenNumber(Math.max(MIN_BOX, Math.floor(settings.width * widthFactor)));
  let nextFps = Math.max(MIN_FPS, Math.floor(settings.fps * fpsFactor));
  let nextColors = settings.colors;

  if (currentSize > TARGET_GIF_SIZE * 1.3) {
    nextColors = nextColorStep(settings.colors);
  } else if (settings.colors > COLOR_STEPS[COLOR_STEPS.length - 1]) {
    nextColors = nextColorStep(settings.colors);
  }

  if (nextWidth === settings.width && nextFps === settings.fps && nextColors === settings.colors) {
    if (settings.width > MIN_BOX) {
      nextWidth = evenNumber(Math.max(MIN_BOX, settings.width - 20));
    } else if (settings.fps > MIN_FPS) {
      nextFps = settings.fps - 1;
    } else if (settings.colors > COLOR_STEPS[COLOR_STEPS.length - 1]) {
      nextColors = nextColorStep(settings.colors);
    } else {
      return null;
    }
  }

  return {
    width: nextWidth,
    fps: nextFps,
    colors: nextColors,
  };
}

async function loadFfmpeg() {
  if (state.ffmpegReady) return;
  if (state.loadPromise) return state.loadPromise;

  state.loadPromise = (async () => {
    setStatus("ffmpeg.wasm 로딩 중...");
    appendLog("ffmpeg.wasm 코어를 불러오는 중입니다.");
    const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm");
    await state.ffmpeg.load({ coreURL, wasmURL });
    state.ffmpegReady = true;
    appendLog("ffmpeg.wasm 준비 완료");
  })();

  return state.loadPromise;
}

async function safeDelete(path) {
  try {
    await state.ffmpeg.deleteFile(path);
  } catch {
    // Ignore missing files and cleanup errors.
  }
}

async function convertSingle(entry, index, total, settings) {
  const inputName = `${index}-${slugify(entry.file.name)}-input.${entry.file.name.split(".").pop() || "mp4"}`;
  const outputName = `${index}-${slugify(entry.file.name)}.gif`;
  const uploaded = await fetchFile(entry.file);
  await state.ffmpeg.writeFile(inputName, uploaded);

  let current = {
    width: settings.width,
    fps: settings.fps,
    colors: 256,
  };

  if (entry.meta?.duration >= 20) {
    current.colors = 224;
  }

  let attempts = 0;
  while (attempts < 8) {
    if (state.cancelRequested) {
      throw new Error("취소됨");
    }

    attempts += 1;
    state.activeIndex = index;
    state.activeProgress = 0;
    setStatus(`${index + 1}/${total} 파일 변환 중`);
    appendLog(`[${entry.file.name}] ${attempts}차 시도 - ${current.width}px / ${current.fps}fps / 색상 ${current.colors}`);

    let blob;
    let size;
    try {
      await state.ffmpeg.exec([
        "-i",
        inputName,
        "-filter_complex",
        buildFilterComplex(current.width, current.fps, current.colors),
        "-map",
        "[out]",
        "-loop",
        "0",
        outputName,
      ]);

      const data = await state.ffmpeg.readFile(outputName);
      blob = new Blob([data], { type: "image/gif" });
      size = blob.size;
    } catch (error) {
      await safeDelete(outputName);
      await safeDelete(inputName);
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        sourceId: entry.id,
        sourceName: entry.file.name,
        error: `변환 실패: ${message}`,
      };
    }

    await safeDelete(outputName);

    if (size <= 0) {
      await safeDelete(inputName);
      return {
        success: false,
        sourceId: entry.id,
        sourceName: entry.file.name,
        error: "출력 GIF가 비어 있습니다. 원본 파일이나 변환 설정을 다시 확인해 주세요.",
      };
    }

    if (size <= TARGET_GIF_SIZE) {
      await safeDelete(inputName);
      const url = URL.createObjectURL(blob);
      return {
        success: true,
        sourceId: entry.id,
        sourceName: entry.file.name,
        outputName,
        size,
        width: current.width,
        fps: current.fps,
        attempts,
        blob,
        url,
      };
    }

    const next = nextAttempt(current, size);
    if (!next) {
      await safeDelete(inputName);
      return {
        success: false,
        sourceId: entry.id,
        sourceName: entry.file.name,
        error: "20MB 이하로 줄이지 못했습니다. 더 짧은 클립으로 다시 시도해 주세요.",
      };
    }

    appendLog(`[${entry.file.name}] ${formatBytes(size)}로 제한 초과, 다시 압축합니다.`);
    current = next;
  }

  await safeDelete(inputName);
  return {
    success: false,
    sourceId: entry.id,
    sourceName: entry.file.name,
    error: "자동 재시도 횟수를 초과했습니다. 더 짧은 영상으로 다시 시도해 주세요.",
  };
}

async function convertAll() {
  if (state.processing) return;

  await Promise.all(state.files.map((entry) => entry.validationPromise ?? Promise.resolve()));

  const validEntries = state.files.filter((entry) => entry.valid);
  if (validEntries.length === 0) {
    setStatus("변환 가능한 파일이 없습니다.");
    appendLog("변환 가능한 파일을 먼저 추가해 주세요.");
    return;
  }

  state.processing = true;
  state.cancelRequested = false;
  revokeResultUrls();
  state.results = [];
  state.activeIndex = 0;
  state.activeProgress = 0;
  state.activeTotal = validEntries.length;

  setControlsDisabled(true);
  setStatus("일괄 변환 시작");
  els.progressBar.value = 0;
  els.progressDetail.textContent = "0%";
  els.zipState.textContent = "생성 중";
  for (const entry of state.files) {
    if (entry.valid) {
      entry.output = null;
      entry.status = "대기";
      entry.reason = "";
    }
  }
  renderResults();
  appendLog("일괄 변환을 시작했습니다.");

  try {
    await loadFfmpeg();

    for (let i = 0; i < validEntries.length; i += 1) {
      const entry = validEntries[i];
      state.activeIndex = i;
      state.activeProgress = 0;
      entry.status = "변환 중";
      entry.reason = "";
      renderFiles();

      const result = await convertSingle(entry, i, validEntries.length, {
        width: Number(els.boxRange.value),
        fps: Number(els.fpsRange.value),
      });

      if (result.success) {
        const sourceEntry = state.files.find((item) => item.id === result.sourceId);
        if (sourceEntry) {
          sourceEntry.output = result;
          sourceEntry.status = "완료";
          sourceEntry.reason = "";
        }
        state.results.push(result);
        appendLog(`[완료] ${result.sourceName} -> ${result.outputName} (${formatBytes(result.size)})`);
      } else {
        const sourceEntry = state.files.find((item) => item.id === result.sourceId);
        if (sourceEntry) {
          sourceEntry.status = "실패";
          sourceEntry.reason = result.error;
        }
        appendLog(`[실패] ${result.sourceName} - ${result.error}`);
      }

      state.activeIndex = i + 1;
      state.activeProgress = 0;
      const percent = Math.round((state.activeIndex / validEntries.length) * 100);
      els.progressBar.value = percent;
      els.progressDetail.textContent = `${percent}%`;
      renderFiles();
      renderResults();
    }

    setStatus("변환 완료");
    appendLog("모든 변환이 끝났습니다.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    if (message !== "취소됨") {
      appendLog(`[오류] ${message}`);
      setStatus("오류가 발생했습니다.");
      alert(message);
    }
  } finally {
    state.processing = false;
    state.activeProgress = 0;
    state.activeIndex = 0;
    state.activeTotal = 0;
    state.ffmpegReady = state.ffmpeg.loaded;
    setControlsDisabled(false);
    renderFiles();
    renderResults();
    updateSummary();
    els.zipState.textContent = state.results.some((item) => item.success) ? "생성 가능" : "대기";
  }
}

async function downloadZip() {
  const successItems = state.results.filter((item) => item.success);
  if (successItems.length === 0) {
    alert("ZIP으로 묶을 GIF가 없습니다.");
    return;
  }

  if (typeof window.JSZip === "undefined") {
    alert("JSZip을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.");
    return;
  }

  const zip = new window.JSZip();
  for (const item of successItems) {
    zip.file(item.outputName, item.blob);
  }

  setStatus("ZIP 파일 생성 중");
  appendLog("ZIP 다운로드 파일을 생성 중입니다.");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, `GoGIF_${new Date().toISOString().slice(0, 10)}.zip`);
  setStatus("ZIP 다운로드 완료");
}

function cancelConversion() {
  if (!state.processing) return;
  state.cancelRequested = true;
  appendLog("취소 요청을 받았습니다. 현재 파일이 끝나면 중단합니다.");
  setStatus("취소 중");
  try {
    state.ffmpeg.terminate();
  } catch {
    // Ignore termination errors.
  }
  state.ffmpeg = createFfmpegClient();
  state.ffmpegReady = false;
  state.loadPromise = null;
  state.processing = false;
  state.activeIndex = 0;
  state.activeTotal = 0;
  state.activeProgress = 0;
  setControlsDisabled(false);
  els.progressBar.value = 0;
  els.progressDetail.textContent = "0%";
  appendLog("FFmpeg 워커를 종료했습니다. 다음 변환 때 다시 로드합니다.");
  setStatus("대기 중");
}

function handleFiles(fileList) {
  addFiles(fileList);
  updateSummary();
}

function bindEvents() {
  els.browseBtn.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", (event) => {
    if (event.target.files) {
      handleFiles(event.target.files);
    }
    event.target.value = "";
  });

  els.dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });

  els.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });

  els.dropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
  });

  els.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
    if (event.dataTransfer?.files) {
      handleFiles(event.dataTransfer.files);
    }
  });

  els.clearBtn.addEventListener("click", () => {
    if (state.processing) return;
    resetWorkspace();
  });

  els.convertBtn.addEventListener("click", () => {
    convertAll();
  });

  els.cancelBtn.addEventListener("click", () => {
    cancelConversion();
  });

  els.downloadZipBtn.addEventListener("click", () => {
    downloadZip();
  });

  els.boxRange.addEventListener("input", () => {
    els.boxValue.textContent = els.boxRange.value;
  });

  els.fpsRange.addEventListener("input", () => {
    els.fpsValue.textContent = els.fpsRange.value;
  });

  els.fileList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    removeEntry(button.dataset.remove);
  });
}

function initialize() {
  bindEvents();
  document.querySelector(".log-panel")?.remove();
  els.boxValue.textContent = els.boxRange.value;
  els.fpsValue.textContent = els.fpsRange.value;
  els.fileList.innerHTML = makeEmptyState("아직 등록된 파일이 없습니다. 영상을 추가해 주세요.");
  els.resultsList.innerHTML = makeEmptyState("아직 완성된 GIF가 없습니다. 변환을 시작해 주세요.");
  els.log.textContent = "GoGIF가 준비되었습니다. 파일을 추가하면 메타데이터를 읽고 제한을 검사합니다.";
  setStatus("대기 중");
  updateSummary();
  updateProgress();
}

initialize();
