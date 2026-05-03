import { FFmpeg } from "./ffmpeg/index.js";
import { fetchFile, toBlobURL } from "./ffmpeg/util.js";

const SITE_NAME = "GOGIF";
const SITE_URL = "https://gogif.space";
const UPDATE_DATE_TEXT = "2026년 5월 3일";
const UPDATE_DATE_ISO = "2026-05-03";
const CONTACT_EMAIL = "jipgae97@gmail.com";
const LOGO_PATH = "/logo/gogif-logo.png";
const CORE_VERSION = "0.12.10";
const CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_DURATION = 30;
const TARGET_GIF_SIZE = 20 * 1024 * 1024;
const MIN_BOX = 240;
const MIN_FPS = 10;
const COLOR_STEPS = [256, 224, 192, 160, 128, 96, 64, 48, 32, 24, 16];
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "flv", "mpeg", "mpg"]);

const ROUTES = {
  "/": {
    title: `${SITE_NAME} - GIF 만들기와 움짤 만들기`,
    description: "GOGIF의 소개, GIF 만들기와 움짤 만들기 방법, 제작 팁, FAQ와 관련 글을 한눈에 볼 수 있는 메인 페이지입니다.",
    render: renderHomePage,
  },
  "/convert": {
    title: `${SITE_NAME} 변환기 - 동영상을 GIF로 쉽게 변환`,
    description: "GOGIF에서 동영상을 바로 GIF로 변환하고, 크기와 FPS를 조절해 결과를 다운로드할 수 있는 전용 변환 페이지입니다.",
    render: renderConvertPage,
  },
  "/about": {
    title: `${SITE_NAME} 소개 | 동영상을 GIF로 쉽게 변환`,
    description: "GOGIF이 어떤 서비스인지, 누구에게 도움이 되는지, 왜 브라우저에서 쉽게 GIF를 만드는 방식에 집중했는지 소개합니다.",
    render: renderAboutPage,
  },
  "/how-to-use": {
    title: `${SITE_NAME} 사용법 - 영상 GIF 변환 방법`,
    description: "GOGIF에서 영상을 업로드하고 GIF로 변환한 뒤 다운로드하는 방법과 더 좋은 결과물을 만드는 팁을 안내합니다.",
    render: renderHowToUsePage,
  },
  "/blog": {
    title: `GIF 제작 팁과 활용법 | ${SITE_NAME}`,
    description: "동영상을 GIF로 만드는 방법, GIF 용량을 줄이는 방법, SNS에서 GIF를 활용하는 방법을 정리한 GOGIF 블로그 목록입니다.",
    render: renderBlogListPage,
  },
  "/blog/gif-making-guide": {
    title: `GIF 만들기와 움짤 만들기 가장 쉬운 방법 | ${SITE_NAME}`,
    description: "동영상을 GIF로 만들고 움짤로 바꾸는 방법을 처음부터 끝까지 설명하는 GOGIF 안내 글입니다.",
    render: renderGifMakingGuidePage,
  },
  "/blog/video-to-gif-guide": {
    title: `동영상을 GIF로 만드는 가장 쉬운 방법 | ${SITE_NAME}`,
    description: "초보자도 이해하기 쉬운 동영상 GIF 변환 방법을 정리했습니다. GOGIF 사용 흐름과 함께 어떤 장면을 고르면 좋은지도 설명합니다.",
    render: renderVideoToGifGuidePage,
  },
  "/blog/reduce-gif-size": {
    title: `GIF 용량 줄이는 방법 | ${SITE_NAME}`,
    description: "프레임 수, 해상도, 길이, 색상 수, 반복 재생까지 포함해 GIF 용량을 줄이는 실전 팁을 정리한 글입니다.",
    render: renderReduceGifSizePage,
  },
  "/blog/gif-for-social-media": {
    title: `SNS에서 GIF를 활용하는 방법 | ${SITE_NAME}`,
    description: "인스타그램, 블로그, 상세페이지, 메신저에서 GIF를 자연스럽게 활용하는 방법과 짧은 GIF가 효과적인 이유를 설명합니다.",
    render: renderGifForSocialMediaPage,
  },
  "/privacy": {
    title: `${SITE_NAME} 개인정보처리방침`,
    description: "GOGIF의 개인정보처리방침 초안입니다. 수집 정보, 쿠키 사용, Google AdSense 광고 쿠키, 맞춤형 광고, 문의 이메일을 포함합니다.",
    render: renderPrivacyPage,
  },
  "/terms": {
    title: `${SITE_NAME} 이용약관`,
    description: "GOGIF 서비스 목적, 사용자 책임, 업로드한 영상 파일, 저작권, 서비스 변경 및 면책 조항을 담은 이용약관 초안입니다.",
    render: renderTermsPage,
  },
  "/contact": {
    title: `${SITE_NAME} 문의`,
    description: "GOGIF 오류 제보, 기능 제안, 광고/제휴 문의, 개인정보 관련 문의를 위한 연락 페이지입니다.",
    render: renderContactPage,
  },
};

const BLOG_POSTS = [
  {
    path: "/blog/gif-making-guide",
    title: "GIF 만들기와 움짤 만들기 가장 쉬운 방법",
    excerpt: "처음 GIF 만들기나 움짤 만들기를 해보는 사람도 바로 따라 할 수 있도록, 어떤 영상을 고르고 어떻게 변환하면 좋은지 GOGIF 기준으로 정리했습니다.",
  },
  {
    path: "/blog/video-to-gif-guide",
    title: "동영상을 GIF로 만드는 가장 쉬운 방법",
    excerpt: "처음 GIF를 만들어 보는 사람도 따라 하기 쉽도록, 어떤 영상을 고르고 어떻게 자르면 좋은지부터 GOGIF 사용 흐름까지 순서대로 정리했습니다.",
  },
  {
    path: "/blog/reduce-gif-size",
    title: "GIF 용량 줄이는 방법",
    excerpt: "프레임 수, 해상도, 길이, 색상 수, 반복 재생을 어떻게 조절하면 되는지 실전 기준으로 설명하고, GOGIF에서 바로 적용할 수 있는 팁도 함께 담았습니다.",
  },
  {
    path: "/blog/gif-for-social-media",
    title: "SNS에서 GIF를 활용하는 방법",
    excerpt: "인스타그램, 블로그, 상세페이지, 메신저에서 GIF를 어떤 방식으로 쓰면 자연스러운지 예시를 통해 설명합니다.",
  },
];

const app = document.getElementById("app");
let els = {};

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

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function setTitle(title, description) {
  document.title = title;
  updateMeta('meta[name="description"]', "content", description);
  updateMeta('meta[property="og:title"]', "content", title);
  updateMeta('meta[property="og:description"]', "content", description);
  updateMeta('meta[name="twitter:title"]', "content", title);
  updateMeta('meta[name="twitter:description"]', "content", description);
  updateMeta('meta[property="og:url"]', "content", `${SITE_URL}${normalizePath(window.location.pathname)}`);
  updateLink('link[rel="canonical"]', "href", `${SITE_URL}${normalizePath(window.location.pathname)}`);
}

function updateMeta(selector, attribute, value) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    const match = selector.match(/^(meta)\[(name|property)="([^"]+)"\]$/);
    if (match) {
      element.setAttribute(match[2], match[3]);
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function updateLink(selector, attribute, value) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    const match = selector.match(/^(link)\[(rel)="([^"]+)"\]$/);
    if (match) {
      element.setAttribute(match[2], match[3]);
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function navLink(path, label, className = "") {
  const current = normalizePath(window.location.pathname);
  const active = current === path || (path !== "/" && current.startsWith(`${path}/`)) ? "is-active" : "";
  return `<a href="${path}" data-nav class="${[className, active].filter(Boolean).join(" ")}">${label}</a>`;
}

function navButton(path, label, className = "button secondary") {
  return `<a href="${path}" data-nav class="${className}">${label}</a>`;
}

function renderHeader() {
  return `
    <header class="site-header">
      <div class="app-shell">
        <div class="site-header-inner">
          <a class="brand" href="/" data-nav>
            <span class="brand-mark">
              <img src="${LOGO_PATH}" alt="" aria-hidden="true" class="brand-image" />
            </span>
            <span class="brand-copy">
              <strong>${SITE_NAME}</strong>
              <span>동영상을 GIF로 쉽게</span>
            </span>
          </a>
          <nav class="site-nav" aria-label="주요 메뉴">
            ${navLink("/", "Home")}
            ${navLink("/convert", "Convert")}
            ${navLink("/about", "About")}
            ${navLink("/how-to-use", "How to Use")}
            ${navLink("/blog", "Blog")}
            ${navLink("/contact", "Contact")}
          </nav>
        </div>
      </div>
    </header>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div>
            <div class="brand" aria-label="GOGIF 푸터 브랜드">
              <span class="brand-mark">
                <img src="${LOGO_PATH}" alt="" aria-hidden="true" class="brand-image" />
              </span>
              <span class="brand-copy">
                <strong>${SITE_NAME}</strong>
                <span>브라우저에서 바로 만드는 GIF</span>
              </span>
            </div>
            <p>
              GOGIF는 누구나 쉽게 동영상을 GIF로 변환하고, 결과물을 더 보기 좋게 다듬는 방법까지 함께 살펴볼 수 있도록 만든 한국어 웹 도구입니다.
            </p>
          </div>
          <div class="footer-links" aria-label="푸터 링크">
            ${navLink("/convert", "Convert")}
            ${navLink("/about", "About")}
            ${navLink("/how-to-use", "How to Use")}
            ${navLink("/blog", "Blog")}
            ${navLink("/privacy", "Privacy Policy")}
            ${navLink("/terms", "Terms")}
            ${navLink("/contact", "Contact")}
          </div>
        </div>
        <div class="footer-note">
          마지막 업데이트: ${UPDATE_DATE_TEXT} · 문의: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  `;
}

function renderLayout(content) {
  return `
    ${renderHeader()}
    <main class="site-main app-shell">${content}</main>
    <div class="app-shell">${renderFooter()}</div>
  `;
}

function renderConverterSection() {
  return `
    <section class="tool-panel panel fade-in" id="converter">
      <div class="section-head">
        <div>
          <span class="eyebrow">GIF Converter</span>
          <h2>GOGIF 변환 도구</h2>
          <p>바로 사용할 수 있는 전용 변환 페이지입니다. 파일을 올리고 설정을 맞춘 뒤 GIF를 내려받을 수 있습니다.</p>
        </div>
        <div class="section-link-row">
          ${navButton("/how-to-use", "자세한 사용법")}
          ${navButton("/blog", "관련 글 보기")}
        </div>
      </div>

      <div class="converter-grid">
        <div class="converter-main">
          <section class="subpanel">
            <div class="panel-head">
              <div>
                <h3>영상 업로드</h3>
                <p>파일을 끌어다 놓거나 선택 버튼으로 업로드하세요. 용량이 너무 크거나 길이가 긴 영상은 안내 메시지를 확인할 수 있습니다.</p>
              </div>
              <button id="browseBtn" class="button ghost" type="button">파일 선택</button>
            </div>
            <div id="dropzone" class="dropzone" role="button" tabindex="0" aria-label="영상 파일 업로드">
              <input
                id="fileInput"
                type="file"
                accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv,.flv,.mpeg,.mpg"
                multiple
                hidden
              />
              <div class="dropzone-icon">GIF</div>
              <div class="dropzone-copy">
                <strong>여기에 영상을 놓거나 클릭해서 선택하세요</strong>
                <span>한 파일씩 확인하면서 안정적으로 GIF로 변환합니다.</span>
              </div>
            </div>
          </section>

          <section class="subpanel">
            <div class="panel-head">
              <div>
                <h3>선택된 파일</h3>
                <p>영상마다 길이와 해상도를 먼저 확인한 뒤, 변환 가능한 상태인지 표시합니다.</p>
              </div>
              <button id="clearBtn" class="button secondary" type="button">전체 초기화</button>
            </div>
            <div id="fileList" class="file-list"></div>
          </section>

          <section class="subpanel">
            <div class="panel-head">
              <div>
                <h3>완성된 GIF</h3>
                <p>성공한 결과를 개별 다운로드하거나 ZIP으로 묶어서 받을 수 있습니다.</p>
              </div>
              <button id="downloadZipBtn" class="button primary" type="button" disabled>ZIP 다운로드</button>
            </div>
            <div id="resultsList" class="results-list"></div>
          </section>
        </div>

        <aside class="converter-side">
          <section class="subpanel">
            <div class="panel-head">
              <div>
                <h3>변환 설정</h3>
                <p>가로 크기와 FPS를 조절해 GIF의 선명도와 용량을 함께 다룹니다.</p>
              </div>
            </div>

            <label class="field">
              <div class="field-row">
                <span>가로 크기</span>
                <strong><span id="boxValue">480</span>px</strong>
              </div>
              <input id="boxRange" type="range" min="240" max="480" step="20" value="480" />
              <small>영상이 길수록 너무 큰 해상도는 용량을 빠르게 키울 수 있습니다.</small>
            </label>

            <label class="field">
              <div class="field-row">
                <span>FPS</span>
                <strong><span id="fpsValue">12</span>fps</strong>
              </div>
              <input id="fpsRange" type="range" min="10" max="15" step="1" value="12" />
              <small>짧고 빠른 장면은 12~15fps가 자연스럽고, 길이가 길면 10~12fps도 좋습니다.</small>
            </label>
          </section>

          <section class="subpanel">
            <div class="panel-head">
              <div>
                <h3>진행 상태</h3>
                <p id="statusText">대기 중</p>
              </div>
            </div>
            <progress id="progressBar" class="progress" value="0" max="100"></progress>
            <div class="progress-meta">
              <span id="progressDetail">0%</span>
              <span id="summaryText">선택 0개 · 변환 가능 0개</span>
            </div>
            <div class="card-actions" style="margin-top: 14px;">
              <button id="convertBtn" class="button primary" type="button">GIF 변환 시작</button>
              <button id="cancelBtn" class="button secondary" type="button" disabled>취소</button>
            </div>
          </section>

          <section class="subpanel">
            <div class="panel-head">
              <div>
                <h3>추천 기준</h3>
                <p>처리 중에 따로 로그를 보지 않아도, 아래 기준만 기억하면 결과가 더 안정적입니다.</p>
              </div>
            </div>
            <div class="tip-stack">
              <div class="tip-row">
                <strong>짧게 자르기</strong>
                <span>3초에서 10초 정도가 가장 다루기 쉽습니다.</span>
              </div>
              <div class="tip-row">
                <strong>해상도 낮추기</strong>
                <span>화면에서 실제로 보여줄 크기보다 조금 여유 있게 맞추면 충분합니다.</span>
              </div>
              <div class="tip-row">
                <strong>FPS 조절하기</strong>
                <span>빠른 장면은 12~15fps, 길이가 길면 10~12fps가 무난합니다.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderHomePage() {
  return `
    <section class="hero-panel panel fade-in">
      <div>
        <span class="eyebrow">gif 만들기 · 움짤 만들기 · browser ready</span>
        <h1>GIF 만들기와 움짤 만들기를 쉽게 하는 GOGIF</h1>
        <p class="lede">
          GOGIF는 복잡한 편집 프로그램 없이, 웹 브라우저 안에서 바로 GIF 만들기와 움짤 만들기를 할 수 있도록 만든 도구입니다.
          짧은 장면을 빠르게 공유하고 싶을 때, 블로그나 상세페이지에 움직이는 예시가 필요할 때, 메신저에서 가볍게 반응하고 싶을 때 편하게 사용할 수 있습니다.
        </p>
        <div class="cta-row">
          <a class="button primary" href="/convert" data-nav>GIF 만들기</a>
          <a class="button secondary" href="/how-to-use" data-nav>사용법 보기</a>
        </div>
        <div class="chip-row" aria-label="주요 특징">
          <span class="chip">브라우저에서 처리</span>
          <span class="chip">단계별 안내</span>
          <span class="chip">짧은 GIF 최적화</span>
          <span class="chip">모바일 대응</span>
        </div>
      </div>
      <div class="hero-aside">
        <div class="stat-card">
          <strong>9</strong>
          <span>페이지와 글로 구성된 안내형 사이트</span>
        </div>
        <div class="stat-card">
          <strong>2</strong>
          <span>주요 CTA 경로: 소개 읽기와 바로 변환하기</span>
        </div>
        <div class="stat-card">
          <strong>1</strong>
          <span>공통 브랜드 톤으로 이어지는 단일 사이트 구조</span>
        </div>
      </div>
    </section>

    <section class="info-grid cols-3">
      <article class="info-card fade-in">
        <h3>GOGIF 소개</h3>
        <p>GOGIF는 “GIF 만들기”와 “움짤 만들기”를 빠르게 하고 싶다는 가장 단순한 필요에서 출발한 서비스입니다. 빠르게 변환하는 기능은 물론, 왜 이런 설정을 쓰는지까지 함께 설명해 처음 쓰는 사람도 흐름을 놓치지 않도록 만들었습니다.</p>
      </article>
      <article class="info-card fade-in">
        <h3>왜 GIF로 바꾸나요?</h3>
        <p>짧은 반복 장면은 영상보다 GIF가 더 가볍고 눈에 잘 들어올 때가 많습니다. 블로그 튜토리얼, 메신저 반응, 상품 소개처럼 “한눈에 보여주는 장면”이 필요한 곳에서 특히 유용합니다. 그래서 GIF 만들기와 움짤 만들기는 지금도 많이 검색됩니다.</p>
      </article>
      <article class="info-card fade-in">
        <h3>제작 팁</h3>
        <p>짧게 자르고, 너무 높은 해상도를 피하고, 장면의 움직임이 가장 잘 보이는 구간만 고르는 것이 좋습니다. GOGIF는 이런 기준에 맞춰 결과를 보기 쉽게 다듬는 데 초점을 맞췄습니다.</p>
      </article>
    </section>

    <section class="content-panel panel fade-in">
      <div class="section-head">
        <div>
          <span class="eyebrow">How it works</span>
          <h2>동영상을 GIF로 만드는 3단계</h2>
          <p>복잡한 메뉴 없이, 업로드와 설정, 다운로드만 차례대로 진행하면 됩니다.</p>
        </div>
      </div>
      <ol class="steps">
        <li>
          <div>
            <h3>영상 업로드</h3>
            <p>MP4, MOV, AVI, MKV처럼 일반적으로 쓰는 영상 파일을 올립니다. 한 번에 여러 파일을 선택해도 되고, 드래그해서 놓아도 됩니다.</p>
          </div>
        </li>
        <li>
          <div>
            <h3>변환 설정</h3>
            <p>가로 크기와 FPS를 조절해 GIF의 움직임과 용량을 함께 관리합니다. 길이가 긴 영상일수록 조금 더 가볍게 설정하는 것이 좋습니다.</p>
          </div>
        </li>
        <li>
          <div>
            <h3>다운로드</h3>
            <p>변환이 끝나면 개별 GIF를 바로 받거나, 여러 파일을 ZIP으로 묶어 한 번에 내려받을 수 있습니다.</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="content-panel panel fade-in">
      <div class="section-head">
        <div>
          <span class="eyebrow">Try it</span>
          <h2>변환 도구는 별도 페이지에서 사용할 수 있어요</h2>
          <p>홈에서는 GOGIF를 소개하고, 실제 변환은 전용 페이지에서 더 집중해서 사용할 수 있게 나눴습니다.</p>
        </div>
        <div class="section-link-row">
          ${navButton("/convert", "변환 페이지로 이동")}
        </div>
      </div>
      <p class="lede">
        업로드와 변환 설정, 다운로드가 한곳에 모인 전용 페이지로 들어가면 더 빠르게 작업할 수 있습니다.
      </p>
    </section>

    <section class="content-panel panel fade-in">
      <div class="section-head">
        <div>
          <span class="eyebrow">GIF Tips</span>
          <h2>GIF 제작 팁</h2>
          <p>보기 좋고 가벼운 GIF를 만들기 위해 처음부터 기억해 두면 좋은 기준들입니다.</p>
        </div>
      </div>
      <div class="info-grid cols-3">
        <article class="info-card">
          <h3>짧게 자르기</h3>
          <p>GIF는 긴 이야기보다 짧은 장면에 더 잘 맞습니다. 핵심 동작이 나타나는 구간만 남기면 용량도 줄고 전달력도 좋아집니다.</p>
        </article>
        <article class="info-card">
          <h3>해상도 조절하기</h3>
          <p>원본 영상이 크다고 해서 GIF도 크게 만들 필요는 없습니다. 화면에 실제로 보여줄 크기를 먼저 정한 뒤 그에 맞춰 줄이는 편이 효율적입니다.</p>
        </article>
        <article class="info-card">
          <h3>색과 움직임 정리하기</h3>
          <p>움직임이 너무 복잡하거나 색이 많은 구간은 용량이 빠르게 늘어납니다. 단순하고 명확한 장면이 GIF로 보기 좋습니다.</p>
        </article>
      </div>
    </section>

    <section class="content-panel panel fade-in">
      <div class="section-head">
        <div>
          <span class="eyebrow">Related</span>
          <h2>관련 글</h2>
          <p>GIF 만들기와 움짤 만들기를 더 잘 쓰고 싶다면 아래 글부터 읽어보면 좋습니다.</p>
        </div>
      </div>
      <div class="card-grid cols-3">
        ${BLOG_POSTS.map((post) => `
          <article class="blog-card">
            <div class="card-top">
              <div>
                <h3>${escapeHtml(post.title)}</h3>
                <p class="excerpt">${escapeHtml(post.excerpt)}</p>
              </div>
            </div>
            <div class="card-actions">
              <a class="button secondary" href="${post.path}" data-nav>읽기</a>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="content-panel panel fade-in">
      <div class="section-head">
        <div>
          <span class="eyebrow">FAQ</span>
          <h2>자주 묻는 질문</h2>
          <p>처음 사용하는 분들이 많이 궁금해하는 부분을 간단히 정리했습니다.</p>
        </div>
      </div>
      <div class="faq-grid cols-2">
        <div class="faq-card">
          <span class="qa-badge">Q</span>
          <h3>영상 파일은 서버로 전송되나요?</h3>
          <div class="qa-answer">
            <span class="qa-badge answer">A</span>
            <p>GOGIF는 가능한 한 브라우저 안에서 변환을 처리하도록 설계했습니다. 업로드 후의 실제 처리 방식은 브라우저 환경에 따라 달라질 수 있지만, 사용자가 편하게 변환 흐름을 이해하고 이용할 수 있게 하는 데 초점을 맞추고 있습니다.</p>
          </div>
        </div>
        <div class="faq-card">
          <span class="qa-badge">Q</span>
          <h3>어떤 영상이 GIF로 잘 변환되나요?</h3>
          <div class="qa-answer">
            <span class="qa-badge answer">A</span>
            <p>움직임이 분명하고 길이가 짧은 장면이 가장 좋습니다. 제품 시연, 표정 변화, 클릭 흐름, 간단한 튜토리얼처럼 핵심이 빨리 전달되는 영상이 잘 맞습니다.</p>
          </div>
        </div>
        <div class="faq-card">
          <span class="qa-badge">Q</span>
          <h3>용량이 커지면 어떻게 해야 하나요?</h3>
          <div class="qa-answer">
            <span class="qa-badge answer">A</span>
            <p>가로 크기와 FPS를 조금 낮추고, 반복 장면이 많은 구간을 줄이면 대부분 개선됩니다. 긴 영상은 아예 짧은 구간만 잘라서 만드는 편이 훨씬 효율적입니다.</p>
          </div>
        </div>
        <div class="faq-card">
          <span class="qa-badge">Q</span>
          <h3>한 번에 여러 파일도 가능한가요?</h3>
          <div class="qa-answer">
            <span class="qa-badge answer">A</span>
            <p>네. 여러 개의 영상을 한꺼번에 넣고 차례대로 변환할 수 있습니다. 결과가 여러 개일 때는 ZIP 다운로드를 이용하면 관리가 편합니다.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAboutPage() {
  return renderArticlePage({
    eyebrow: "About GOGIF",
    title: "GOGIF은 누구나 쉽게 동영상을 GIF로 만들 수 있도록 만든 웹 도구입니다",
    lead: "GOGIF은 복잡한 편집 프로그램을 열지 않아도, 원하는 영상 장면을 빠르게 GIF로 바꾸고 바로 활용할 수 있게 돕는 것을 목표로 합니다.",
    sideTitle: "GOGIF 한눈에 보기",
    sideParagraphs: [
      "SNS에 올릴 짧은 반응 장면을 만들고 싶을 때",
      "블로그나 상세페이지에 움직이는 예시가 필요할 때",
      "메신저에서 가볍게 공유할 움직임이 필요할 때",
    ],
    sections: [
      {
        title: "누구를 위한 서비스인가요?",
        paragraphs: [
          "GOGIF은 처음 GIF를 만들려고 하는 사람부터, 이미 여러 번 GIF를 써 본 사람까지 모두 편하게 사용할 수 있도록 만든 도구입니다. 영상 편집 프로그램을 설치하고 세밀한 메뉴를 찾는 대신, 필요한 장면만 골라 빠르게 결과를 얻는 흐름에 집중했습니다.",
          "특히 짧은 설명 컷이 필요한 블로그 운영자, 제품 이미지를 더 생생하게 보여주고 싶은 소규모 쇼핑몰 운영자, 메신저나 커뮤니티에서 반응 이미지를 활용하는 사용자에게 잘 맞습니다. “어떻게 만드는지 몰라서 미뤄두는 상황”을 줄이는 것이 GOGIF의 가장 큰 역할입니다.",
        ],
      },
      {
        title: "왜 GIF에 집중했나요?",
        paragraphs: [
          "GIF는 작은 용량으로 빠르게 눈에 들어오는 장점이 있습니다. 짧은 움직임과 반복되는 장면을 보여줄 때 특히 강하고, 별도 재생 버튼을 누르지 않아도 내용이 바로 전달되는 느낌이 있습니다. 이 특성 때문에 블로그 요약, 기능 안내, 반응 이미지, 미리보기 화면에서 꾸준히 쓰입니다.",
          "물론 모든 영상이 GIF에 적합한 것은 아닙니다. 길고 복잡한 장면보다는 짧고 분명한 장면이 더 좋습니다. GOGIF은 이런 특성을 이해한 뒤 “무엇을 GIF로 만들면 좋은지”까지 함께 생각하도록 돕는 웹 도구입니다.",
        ],
      },
      {
        title: "GOGIF의 방향",
        paragraphs: [
          "GOGIF은 단순히 변환만 하는 도구가 아니라, 사용자가 결과를 더 잘 이해하도록 설명 콘텐츠를 함께 제공하는 사이트를 지향합니다. 그래서 메인 화면만 두는 대신, 사용법과 팁, 정책 페이지, 문의 페이지를 갖춰 처음 방문한 사람도 신뢰하고 둘러볼 수 있게 구성했습니다.",
          "앞으로도 기능 자체는 단순하게 유지하되, 필요한 설명은 충분히 제공하는 방향을 유지할 예정입니다. 사용자는 빠르게 GIF를 만들고, 필요한 경우 블로그와 안내 문서를 통해 결과를 더 좋게 다듬는 방법을 찾을 수 있습니다.",
        ],
      },
    ],
    relatedLinks: [
      { path: "/how-to-use", label: "사용법 보기" },
      { path: "/blog", label: "블로그로 이동" },
      { path: "/contact", label: "문의하기" },
    ],
  });
}

function renderHowToUsePage() {
  return renderArticlePage({
    eyebrow: "How to Use",
    title: "GOGIF 사용법 - 영상 GIF 변환 방법",
    lead: "영상 업로드, 변환 설정, GIF 다운로드까지의 흐름을 처음 쓰는 사람도 바로 이해할 수 있도록 단계별로 정리했습니다.",
    sideTitle: "빠른 체크",
    sideParagraphs: [
      "길이가 너무 긴 영상은 먼저 자르는 것이 좋습니다.",
      "GIF는 짧고 분명한 장면일수록 결과가 예쁩니다.",
      "결과가 무거우면 가로 크기와 FPS를 조금 낮춰 보세요.",
    ],
    sections: [
      {
        title: "1. 영상 업로드",
        paragraphs: [
          "메인 페이지의 업로드 영역을 클릭하거나, 파일을 드래그해서 놓으면 됩니다. 일반적으로 많이 쓰는 MP4, MOV, AVI, MKV, WEBM 같은 형식을 대부분 지원하도록 설계했습니다. 여러 파일을 한 번에 골라서 넣어도 순서대로 확인할 수 있습니다.",
          "업로드 후에는 파일마다 길이와 해상도를 먼저 확인합니다. 이 단계에서 너무 길거나 용량이 큰 영상은 안내 메시지를 보고 조정할 수 있습니다. 처음부터 결과가 작고 보기 좋게 나오도록, 영상의 특성을 먼저 살펴보는 것이 중요합니다.",
        ],
      },
      {
        title: "2. 변환 설정",
        paragraphs: [
          "가로 크기는 GIF의 선명도와 용량에 가장 큰 영향을 줍니다. 화면에서 보여줄 실제 크기보다 지나치게 크게 둘 필요는 없습니다. 240px에서 480px 범위 안에서 조절해 보면서 가장 보기 좋은 지점을 찾는 편이 좋습니다.",
          "FPS는 움직임의 부드러움을 결정합니다. 너무 낮으면 장면이 끊겨 보이고, 너무 높으면 용량이 급격히 늘 수 있습니다. 보통 10~15fps 범위에서 시작해, 장면이 짧고 빠르면 조금 높이고, 길이가 길면 조금 낮추는 식으로 조정하면 됩니다.",
        ],
      },
      {
        title: "3. 다운로드",
        paragraphs: [
          "변환이 완료되면 결과 카드에서 개별 GIF를 바로 받을 수 있습니다. 여러 파일을 한 번에 처리했다면 ZIP 다운로드를 사용해 정리하면 편합니다. 이때 결과 이름은 원본 이름을 바탕으로 자동 생성되므로 관리가 쉽습니다.",
          "다운로드한 뒤에는 실제로 어디에 붙일지 한 번 더 생각해 보는 것이 좋습니다. 블로그 본문용인지, 상세페이지용인지, 메신저용인지에 따라 적당한 길이와 해상도가 조금 달라질 수 있기 때문입니다.",
        ],
      },
      {
        title: "좋은 GIF를 위한 팁",
        paragraphs: [
          "첫째, 핵심 장면만 남기세요. 설명이 끝나기 전의 장면이나 너무 느린 구간은 잘라내는 편이 좋습니다. 둘째, 배경이 복잡한 장면보다는 움직임이 분명한 장면이 더 안정적입니다. 셋째, 색이 지나치게 많은 화면은 용량이 커질 수 있으니 주의하세요.",
          "조금 더 실용적으로 말하면, GIF는 “짧게 보여주고 끝내는 화면”에 잘 맞습니다. GOGIF에서는 이러한 흐름을 반영해, 작업 중에도 용량과 길이를 고려한 기준을 안내하도록 구성했습니다.",
        ],
      },
      {
        title: "자주 묻는 질문",
        paragraphs: [
          "Q. 여러 파일을 동시에 바꿀 수 있나요? A. 가능합니다. 한 번에 넣고 순서대로 처리할 수 있습니다. Q. 너무 큰 영상은 어떻게 하나요? A. 먼저 짧은 구간으로 자른 뒤 변환하는 것이 좋습니다. Q. 설정을 잘 모르겠어요. A. 기본값으로 시작한 뒤 결과를 보고 조금씩 조정하면 됩니다.",
          "처음에는 “잘 될까?” 하는 걱정이 들 수 있지만, GIF는 의외로 기준이 단순합니다. 짧게, 분명하게, 가볍게라는 세 가지 원칙만 기억해도 훨씬 좋은 결과를 만들 수 있습니다.",
        ],
      },
    ],
    relatedLinks: [
      { path: "/blog/video-to-gif-guide", label: "가장 쉬운 방법 읽기" },
      { path: "/blog/reduce-gif-size", label: "용량 줄이는 법 보기" },
      { path: "/contact", label: "문의하기" },
    ],
  });
}

function renderBlogListPage() {
  return `
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">Blog</span>
        <h1>GIF 제작 팁과 움짤 만들기 활용법</h1>
        <p class="summary">
          GOGIF 블로그에서는 GIF 만들기와 움짤 만들기의 가장 쉬운 방법, 용량을 줄이는 실전 팁, SNS에서 GIF를 잘 활용하는 방법을 차근차근 정리합니다.
        </p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>왜 글이 필요할까요?</h3>
          <p>도구만 있으면 끝나는 것처럼 보여도, 실제로는 어떤 장면이 GIF에 맞는지와 어떤 설정이 좋은지 아는 것이 중요합니다. 그래서 GOGIF은 GIF 만들기와 움짤 만들기에 맞는 설명 콘텐츠를 함께 제공합니다.</p>
        </div>
        <div class="mini-panel">
          <h3>추천 읽기 순서</h3>
          <p>1. GIF 만들기와 움짤 만들기 2. 용량 줄이는 방법 3. SNS 활용법 순으로 읽으면 흐름이 자연스럽습니다.</p>
        </div>
      </div>
    </section>

    <section class="card-grid cols-3">
      ${BLOG_POSTS.map((post) => `
        <article class="blog-card panel fade-in">
          <div class="card-top">
            <div>
              <span class="tag">GOGIF Blog</span>
              <h3>${escapeHtml(post.title)}</h3>
              <p class="excerpt">${escapeHtml(post.excerpt)}</p>
            </div>
          </div>
          <div class="card-actions">
            <a class="button primary" href="${post.path}" data-nav>글 읽기</a>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderGifMakingGuidePage() {
  return renderBlogPostPage({
    eyebrow: "Blog · Starter Guide",
    title: "GIF 만들기와 움짤 만들기 가장 쉬운 방법",
    lead: "처음 GIF 만들기나 움짤 만들기를 해보는 사람도 따라 할 수 있도록, 어떤 영상을 고르고 어떻게 변환하면 좋은지 순서대로 정리했습니다.",
    toc: [
      { id: "same", label: "1. 같은 말일까?" },
      { id: "choose", label: "2. 영상 고르기" },
      { id: "convert", label: "3. GOGIF로 만들기" },
      { id: "tips", label: "4. 더 보기 좋게" },
      { id: "use", label: "5. 어디에 쓰면 좋나" },
    ],
    sections: [
      {
        id: "same",
        title: "1. GIF 만들기와 움짤 만들기는 같은 뜻에 가깝습니다",
        paragraphs: [
          "일상에서는 GIF 만들기와 움짤 만들기를 거의 같은 뜻으로 씁니다. 둘 다 짧은 움직임을 반복되는 이미지로 바꿔서, 영상보다 가볍고 빠르게 보여주기 위한 방식입니다. 그래서 검색할 때도 두 표현을 함께 찾는 경우가 많습니다.",
          "GOGIF는 이 둘을 따로 나누지 않고, 짧은 장면을 쉽게 GIF로 만들고 움직이는 이미지로 쓰는 과정 전체를 도와주는 서비스라고 보면 이해하기 쉽습니다. 즉, 이름은 달라도 사용 목적은 비슷합니다.",
        ],
      },
      {
        id: "choose",
        title: "2. 어떤 영상을 고르면 GIF 만들기가 쉬울까요?",
        paragraphs: [
          "움직임이 분명하고 길이가 짧은 영상이 가장 좋습니다. 예를 들어 버튼을 누르는 장면, 표정이 바뀌는 순간, 제품의 핵심 기능이 드러나는 부분처럼 한눈에 이해되는 장면은 움짤로 만들었을 때 전달력이 좋습니다.",
          "반대로 배경이 복잡하거나 설명이 너무 길게 이어지는 영상은 GIF로 만들면 오히려 무거워질 수 있습니다. 그래서 GIF 만들기를 처음 할 때는 전체를 바꾸기보다, 가장 중요한 부분만 잘라서 시작하는 편이 훨씬 편합니다.",
        ],
      },
      {
        id: "convert",
        title: "3. GOGIF에서 GIF 만들기",
        paragraphs: [
          "GOGIF 메인 페이지에서 영상을 업로드한 뒤, 가로 크기와 FPS를 조절하면 바로 변환할 수 있습니다. 설정이 어렵다면 기본값으로 시작한 뒤 결과를 보고 조금씩 낮추는 방식이 가장 편합니다.",
          "작업이 끝나면 개별 파일로 내려받을 수도 있고, 여러 개를 한 번에 ZIP으로 받을 수도 있습니다. 여러 장면을 순서대로 비교해 보고 싶을 때도 편해서, 움짤 만들기 초보자에게 특히 잘 맞습니다.",
        ],
      },
      {
        id: "tips",
        title: "4. 더 보기 좋게 만들고 싶다면 이렇게 해보세요",
        paragraphs: [
          "GIF는 짧고 단순할수록 보기 좋습니다. 그래서 3초에서 10초 정도의 짧은 구간을 고르면 대부분 안정적입니다. 해상도는 실제로 보여줄 크기보다 조금만 여유 있게 두면 충분한 경우가 많습니다.",
          "또 하나 중요한 건 반복의 자연스러움입니다. 시작과 끝이 부드럽게 이어지는 장면을 고르면 움짤이 훨씬 자연스럽습니다. GOGIF은 이런 점을 고려해 브라우저 안에서 빠르게 다시 시도할 수 있게 설계했습니다.",
        ],
      },
      {
        id: "use",
        title: "5. GIF 만들기 결과물은 어디에 쓰면 좋을까요?",
        paragraphs: [
          "블로그 글에서는 사용법이나 전후 비교를 보여줄 때 유용하고, 상세페이지에서는 제품의 기능을 간단히 보여주기 좋습니다. 메신저에서는 감정 표현이나 짧은 반응을 전달하기에도 좋습니다.",
          "결국 GIF 만들기와 움짤 만들기의 목적은 복잡한 설명을 짧게 줄여서 보여주는 데 있습니다. 그래서 “짧은 장면을 바로 보여주고 싶다”는 생각이 들면 GIF가 좋은 선택이 됩니다.",
        ],
      },
    ],
  });
}

function renderVideoToGifGuidePage() {
  return renderBlogPostPage({
    eyebrow: "Blog · Guide",
    title: "동영상을 GIF로 만드는 가장 쉬운 방법",
    lead: "처음 GIF를 만드는 사람도 따라 할 수 있도록, 어떤 영상을 고르고 어떤 흐름으로 작업하면 좋은지 차근차근 정리한 글입니다.",
    toc: [
      { id: "choose", label: "1. 영상 고르기" },
      { id: "trim", label: "2. 짧게 자르기" },
      { id: "settings", label: "3. 설정 조절하기" },
      { id: "gogif", label: "4. GOGIF로 변환하기" },
      { id: "tips", label: "5. 결과 다듬기" },
    ],
    sections: [
      {
        id: "choose",
        title: "1. 어떤 영상을 고르면 좋을까?",
        paragraphs: [
          "GIF는 길게 설명하는 형식보다, 짧은 변화나 반복 장면을 보여줄 때 더 효과적입니다. 그래서 전체 영상을 통째로 바꾸기보다는, 핵심이 드러나는 짧은 구간을 골라 시작하는 편이 좋습니다. 예를 들어 제품의 버튼이 눌리는 순간, 손동작이 바뀌는 순간, 표정이 바뀌는 순간처럼 시각적으로 변화를 느끼기 쉬운 장면이 잘 맞습니다.",
          "처음에는 “어떤 장면이 가장 중요한가?”를 먼저 생각해 보세요. 시청자가 GIF를 봤을 때 1초 안에 이해할 수 있는 장면이면 대체로 성공 확률이 높습니다. 반대로 배경이 너무 복잡하거나 움직임이 산만한 장면은 핵심이 잘 보이지 않아 결과가 답답해질 수 있습니다.",
        ],
      },
      {
        id: "trim",
        title: "2. 왜 짧게 잘라야 할까?",
        paragraphs: [
          "GIF는 영상처럼 긴 호흡을 전제로 하지 않습니다. 반복 재생되는 특성 때문에, 짧은 시간 안에 메시지를 전달할수록 더 보기 좋습니다. 보통 3초에서 10초 사이의 짧은 구간이 가장 다루기 쉽고, 페이지에 넣었을 때도 부담이 적습니다.",
          "길이가 길수록 프레임 수도 많아지고, 결과 파일이 커질 가능성도 높아집니다. 따라서 처음부터 “짧게 끝나는 장면”을 고르거나, 필요한 부분만 잘라내는 습관이 중요합니다. GOGIF을 사용할 때도 긴 파일보다 짧은 파일이 훨씬 빠르고 안정적으로 결과를 얻기 좋습니다.",
        ],
      },
      {
        id: "settings",
        title: "3. 설정은 어떻게 맞추면 좋을까?",
        paragraphs: [
          "가로 크기와 FPS는 GIF의 성격을 결정하는 두 축입니다. 가로 크기가 크면 선명하지만 용량이 늘어나고, FPS가 높으면 움직임이 부드럽지만 역시 용량이 커집니다. 그래서 처음에는 기본값으로 시작한 뒤, 결과를 보고 조금씩 조절하는 방식이 가장 실용적입니다.",
          "정답은 하나가 아니지만, 짧은 데모나 반응 이미지라면 12fps 전후와 중간 정도 해상도에서 시작하는 것이 무난합니다. 만약 웹페이지나 메신저에서 빠르게 보여주고 싶다면 조금 더 가볍게, 상세한 제품 소개처럼 선명도가 중요하다면 해상도를 살짝 유지하는 방식이 좋습니다.",
        ],
      },
      {
        id: "gogif",
        title: "4. GOGIF로 변환하는 흐름",
        paragraphs: [
          "GOGIF 메인 화면에서 영상을 업로드하면 파일 정보를 먼저 확인할 수 있습니다. 그 다음 가로 크기와 FPS를 조절하고 변환을 시작하면, 브라우저 안에서 GIF가 만들어집니다. 결과가 여러 개일 때는 개별 다운로드뿐 아니라 ZIP으로도 받을 수 있어 정리하기 쉽습니다.",
          "작업 중에는 진행 상태와 로그가 보여서, 현재 어느 파일이 처리 중인지 확인할 수 있습니다. 처음 사용하는 사람도 “파일 업로드 → 설정 조절 → 다운로드”의 순서를 따라가면 크게 어렵지 않게 완료할 수 있도록 구성했습니다.",
        ],
      },
      {
        id: "tips",
        title: "5. 결과를 더 좋게 다듬는 방법",
        paragraphs: [
          "변환이 끝났다면 한 번 더 확인해 보세요. 첫 프레임이 너무 어둡거나, 마지막 프레임이 어색하게 끊기면 시작과 끝을 조금 다시 잡는 것만으로도 훨씬 자연스러워집니다. 또 설명문과 함께 쓰는 경우에는 GIF 자체가 너무 복잡하지 않은지 확인하는 것이 좋습니다.",
          "처음 GIF를 만들 때는 완벽함보다 흐름이 중요합니다. 빠르게 한 번 만들어 보고, 필요하면 다시 짧게 자르고 설정을 조금 낮추는 방식이 가장 배우기 쉽습니다. GOGIF은 이런 반복 조정을 어렵지 않게 할 수 있도록 기본값과 안내 문구를 함께 제공합니다.",
        ],
      },
    ],
  });
}

function renderReduceGifSizePage() {
  return renderBlogPostPage({
    eyebrow: "Blog · Optimization",
    title: "GIF 용량 줄이는 방법",
    lead: "GIF가 너무 무거워서 웹페이지에 넣기 어렵다면, 프레임 수와 해상도, 길이, 색상 수, 반복 재생을 차근차근 조절해 보세요.",
    toc: [
      { id: "frames", label: "1. 프레임 수" },
      { id: "resolution", label: "2. 해상도" },
      { id: "length", label: "3. 길이" },
      { id: "colors", label: "4. 색상 수" },
      { id: "loop", label: "5. 반복 재생" },
      { id: "beforeafter", label: "6. GOGIF 사용 전/후 팁" },
    ],
    sections: [
      {
        id: "frames",
        title: "1. 프레임 수를 줄이면 왜 가벼워질까?",
        paragraphs: [
          "GIF는 여러 장의 이미지를 빠르게 이어 붙인 형태라서, 프레임 수가 많을수록 파일이 커집니다. 움직임이 아주 부드러워야 하는 장면이 아니라면, 조금 더 낮은 FPS로도 충분히 자연스럽게 보일 수 있습니다. 보통 10~15fps 범위에서 시작해서 결과를 보고 조절하는 것이 좋습니다.",
          "프레임 수를 너무 많이 유지하면 작은 장면도 예상보다 무거워질 수 있습니다. 특히 배경 변화가 많은 영상은 프레임 하나하나의 정보량이 커서 용량이 빨리 늘어납니다. 따라서 “필요한 만큼만 보여준다”는 기준으로 프레임 수를 다루는 것이 핵심입니다.",
        ],
      },
      {
        id: "resolution",
        title: "2. 해상도는 결과의 균형을 결정한다",
        paragraphs: [
          "해상도는 GIF의 선명도와 용량을 동시에 건드립니다. 원본 영상을 그대로 쓰고 싶어도, 실제로 웹이나 메신저에서 보여줄 크기를 생각하면 지나치게 큰 해상도는 불필요한 경우가 많습니다. 화면에 넣을 크기보다 약간 여유 있는 정도면 충분한 일이 많습니다.",
          "예를 들어 블로그 본문에 넣을 짧은 GIF라면 400px 안팎의 가로 크기만으로도 충분한 경우가 많습니다. 반면 상세페이지에서 제품의 작은 움직임을 강조해야 한다면, 조금 더 큰 해상도를 유지해도 됩니다. 중요한 것은 “지금 사용할 환경”에 맞춰 크기를 정하는 습관입니다.",
        ],
      },
      {
        id: "length",
        title: "3. 길이를 짧게 만들수록 유리하다",
        paragraphs: [
          "GIF는 한 번 보면 바로 이해되는 짧은 장면에 잘 맞습니다. 길이가 길어질수록 프레임 수가 쌓이고, 반복 재생하면서 보는 사람의 집중도도 떨어질 수 있습니다. 그래서 처음부터 3초에서 8초 정도로 짧게 잡는 경우가 많습니다.",
          "긴 영상이 꼭 필요하다면 전체를 하나의 GIF로 만들기보다는, 장면별로 나누어 여러 개의 짧은 GIF로 만드는 편이 오히려 보기 좋습니다. 이렇게 하면 각각의 메시지가 분명해지고, 파일 크기도 더 잘 관리할 수 있습니다.",
        ],
      },
      {
        id: "colors",
        title: "4. 색상 수를 줄이면 용량도 낮아진다",
        paragraphs: [
          "GIF는 색상 표현 방식상 이미지의 색상 수가 많아질수록 부담이 커질 수 있습니다. 물론 화려한 장면에서는 색이 풍부한 것이 자연스럽지만, 움직임을 설명하는 목적이라면 꼭 모든 색을 살릴 필요는 없습니다. 그래서 색상 수를 조금 낮추는 방식이 종종 유효합니다.",
          "색을 너무 많이 유지하려고 하면 파일이 무거워질 뿐 아니라, 오히려 애매한 색 번짐이 생길 때도 있습니다. 이런 경우에는 약간 더 단순한 색상 팔레트가 깔끔하게 보일 수 있습니다. GOGIF은 결과를 더 작게 만들기 위해 색상 수를 단계적으로 낮추는 방향도 고려하도록 설계했습니다.",
        ],
      },
      {
        id: "loop",
        title: "5. 반복 재생은 짧을수록 더 안정적이다",
        paragraphs: [
          "GIF는 기본적으로 반복 재생되는 이미지 형식이라, 짧고 명확한 움직임이 있을수록 효과가 좋습니다. 반복이 길어질수록 시청자는 같은 장면을 여러 번 보게 되고, 필요 이상의 길이는 오히려 지루함을 만들 수 있습니다.",
          "반복 재생을 잘 쓰려면 시작과 끝이 자연스럽게 이어지는 구간을 고르는 것이 중요합니다. 갑자기 끊기는 장면보다는, 같은 동작이 부드럽게 이어지는 장면이 반복될 때 훨씬 보기 좋습니다. GIF의 반복 특성을 활용하되, 지루하지 않은 구간을 찾는 것이 핵심입니다.",
        ],
      },
      {
        id: "beforeafter",
        title: "6. GOGIF 사용 전/후로 나눠 생각하면 편하다",
        paragraphs: [
          "사용 전에는 “이 장면이 꼭 필요한가?”를 먼저 묻는 것이 좋습니다. 길이와 범위를 줄이는 것만으로도 많은 경우 용량이 크게 낮아집니다. 사용 후에는 결과 크기와 재생 느낌을 보고, 필요하다면 가로 크기나 FPS를 조금 더 낮춰 다시 만들어 보세요.",
          "GOGIF은 이런 반복 조정을 어렵지 않게 해 주는 방향으로 설계했습니다. 처음 결과가 조금 무겁더라도, 설정을 살짝 낮추고 다시 시도하면 꽤 많은 경우 만족스러운 지점에 도달할 수 있습니다. 결국 GIF 최적화는 “얼마나 작은 용량으로 핵심을 유지하느냐”의 문제라고 볼 수 있습니다.",
        ],
      },
    ],
  });
}

function renderGifForSocialMediaPage() {
  return renderBlogPostPage({
    eyebrow: "Blog · Social",
    title: "SNS에서 GIF를 활용하는 방법",
    lead: "인스타그램, 블로그, 상세페이지, 메신저에서 GIF를 어떤 식으로 쓰면 자연스럽고 효과적인지 실제 활용 예시 중심으로 정리했습니다.",
    toc: [
      { id: "short", label: "1. 짧은 GIF가 효과적인 이유" },
      { id: "instagram", label: "2. 인스타그램 활용" },
      { id: "blog", label: "3. 블로그 활용" },
      { id: "detail", label: "4. 상세페이지 활용" },
      { id: "messenger", label: "5. 메신저 활용" },
    ],
    sections: [
      {
        id: "short",
        title: "1. 짧은 GIF가 왜 효과적일까?",
        paragraphs: [
          "SNS와 웹페이지에서는 사용자가 오래 기다리지 않아도 바로 이해되는 콘텐츠가 중요합니다. GIF는 짧은 시간 안에 핵심 장면을 반복해서 보여주기 때문에, 설명이 길지 않아도 감각적으로 내용을 전달하기 쉽습니다. 스크롤이 빠른 환경에서는 이런 즉시성이 큰 장점이 됩니다.",
          "또한 GIF는 일반 영상보다 더 가볍게 느껴지는 경우가 많아, 메시지 안에서 부담 없이 보이기도 합니다. 한 장의 이미지보다 조금 더 많은 정보를 주고, 긴 영상보다 덜 무거운 느낌이 필요할 때 GIF가 딱 맞습니다. 그래서 짧고 분명한 장면을 보여줄 때 특히 강합니다.",
        ],
      },
      {
        id: "instagram",
        title: "2. 인스타그램에서는 어떻게 쓸까?",
        paragraphs: [
          "인스타그램에서 GIF를 직접 올리는 방식은 상황에 따라 다르지만, 스토리나 DM, 소개용 콘텐츠처럼 짧은 시각 효과가 필요한 곳에서는 매우 유용합니다. 예를 들어 제품의 작은 동작, 포인트 문구가 바뀌는 장면, 이벤트 안내의 한 줄 요약을 보여줄 때 GIF 형태의 이미지는 시선을 끌기 좋습니다.",
          "다만 플랫폼의 업로드 방식에 따라 실제 표시 형식은 영상으로 바뀌거나, 해석이 달라질 수 있습니다. 그래서 인스타그램용으로 준비할 때는 너무 길게 만들기보다, 한 장면만 명확하게 보여주는 짧은 구성이 더 안정적입니다. 핵심은 “스크롤 중에도 바로 이해되는가”입니다.",
        ],
      },
      {
        id: "blog",
        title: "3. 블로그에서는 정보 전달력을 높여준다",
        paragraphs: [
          "블로그에서는 글만으로 설명하기 어려운 부분을 GIF가 대신해 줍니다. 사용법 안내, 기능 소개, 전후 비교처럼 움직임이 필요한 설명을 짧은 GIF로 보여주면 독자의 이해 속도가 빨라집니다. 글을 길게 쓰지 않아도 장면 하나만으로 의미가 전달되는 것이 장점입니다.",
          "특히 튜토리얼 글에서는 한 번에 보이는 짧은 GIF가 매우 유용합니다. 클릭 위치, 드래그 방향, 선택해야 할 메뉴 같은 부분은 텍스트보다 GIF가 더 직관적일 때가 많습니다. GOGIF로 만든 짧은 예시는 글 전체의 리듬을 가볍게 해 주는 역할도 합니다.",
        ],
      },
      {
        id: "detail",
        title: "4. 상세페이지에서는 제품을 더 생생하게 보여준다",
        paragraphs: [
          "상세페이지에서는 정지 이미지 몇 장만으로 전달하기 어려운 정보가 있습니다. 버튼이 눌리는 느낌, 소재의 질감이 바뀌는 순간, 화면 전환의 부드러움처럼 작은 움직임은 GIF로 보여주면 훨씬 이해가 잘 됩니다. 사용자는 이미지를 넘겨 보기만 해도 흐름을 느낄 수 있습니다.",
          "이때 중요한 것은 너무 화려하게 만들지 않는 것입니다. 상세페이지의 GIF는 “제품을 이해시키는 보조 수단”이지, 본문을 압도하는 주인공은 아닙니다. 핵심 기능이나 포인트 한 가지만 보여주는 짧은 GIF가 오히려 더 신뢰감 있게 보입니다.",
        ],
      },
      {
        id: "messenger",
        title: "5. 메신저에서는 반응과 맥락을 동시에 전달한다",
        paragraphs: [
          "메신저에서 GIF는 이모지보다 더 풍부하고, 긴 영상보다 덜 부담스럽습니다. 짧은 리액션 장면, 축하 메시지, 상황을 설명하는 간단한 움직임은 대화의 분위기를 자연스럽게 만들어 줍니다. 글만 보내기 애매할 때 GIF는 꽤 좋은 중간 지점이 됩니다.",
          "다만 메신저에서 쓰는 GIF는 지나치게 길거나 무거우면 불편할 수 있습니다. 그래서 더 짧고 가벼운 버전으로 만들어 두면 활용 범위가 넓어집니다. GOGIF은 이런 실사용 기준에 맞게 결과를 작고 단순하게 유지하는 데 도움이 됩니다.",
        ],
      },
    ],
  });
}

function renderPrivacyPage() {
  return renderStaticPolicyPage({
    eyebrow: "Privacy Policy",
    title: "GOGIF 개인정보처리방침",
    lead: "본 문서는 GOGIF 웹사이트를 위한 일반적인 개인정보처리방침 초안입니다. 법률 자문이 아니며, 실제 서비스 운영 전에는 필요에 따라 검토와 수정이 필요할 수 있습니다.",
    body: `
      <div class="prose">
        <p>최종 업데이트: ${UPDATE_DATE_TEXT}</p>
        <h2>1. 수집할 수 있는 정보</h2>
        <p>GOGIF는 웹사이트 운영 과정에서 사용자가 입력하거나 브라우저가 자동으로 전달하는 일부 정보를 수집할 수 있습니다. 예를 들어 문의 페이지에서 사용자가 직접 입력한 이름, 이메일 주소, 메시지 내용이 있을 수 있고, 서비스 품질 개선을 위해 접속 시간, 브라우저 종류, 기기 정보, 접속 로그처럼 일반적인 이용 기록이 기록될 수 있습니다.</p>
        <p>GOGIF의 핵심 변환 기능은 브라우저에서 동작하도록 설계되어 있습니다. 따라서 영상 파일은 가능하면 사용자의 브라우저 환경에서 처리되며, 서비스가 의도적으로 영상 파일을 영구 저장하는 방향은 아닙니다. 다만 브라우저 환경이나 서비스 운영 방식에 따라 임시 데이터가 생성될 수 있으므로, 사용자는 민감한 자료를 업로드할 때 주의가 필요합니다.</p>

        <h2>2. 쿠키 사용 안내</h2>
        <p>GOGIF는 사이트 기능 제공, 사용 환경 개선, 트래픽 분석, 광고 제공을 위해 쿠키 또는 유사한 추적 기술을 사용할 수 있습니다. 쿠키는 사용자의 브라우저에 저장되는 작은 정보로, 다음 방문 때 설정을 유지하거나 광고의 성격을 조정하는 데 사용될 수 있습니다.</p>
        <p>Google AdSense와 같은 제3자 광고 제공자는 광고를 표시하고 성과를 측정하기 위해 쿠키를 사용할 수 있습니다. 이러한 쿠키는 사용자의 관심사에 맞는 광고를 제공하는 데 활용될 수 있으며, 사이트 운영자는 광고 제공 과정에서 수집되는 정보를 직접적으로 통제하지 않을 수 있습니다.</p>

        <h2>3. Google AdSense 및 제3자 광고 쿠키</h2>
        <p>GOGIF는 광고를 통해 사이트를 운영할 수 있으며, 이 과정에서 Google과 같은 제3자 광고 네트워크가 쿠키를 사용해 광고를 표시할 수 있습니다. 해당 광고 쿠키는 사용자의 이전 방문 기록이나 관심사에 기반한 맞춤형 광고를 제공할 수 있습니다.</p>
        <p>사용자는 브라우저 설정 또는 Google의 광고 설정 페이지를 통해 맞춤형 광고를 조정하거나 거부할 수 있습니다. 또한 일부 브라우저나 기기에서는 추적 제한 기능을 통해 광고 개인 최적화 수준을 줄일 수 있습니다. GOGIF는 사용자가 이러한 선택을 할 수 있다는 점을 안내하며, 관련 설정은 각 제공자의 정책에 따라 달라질 수 있습니다.</p>

        <h2>4. 정보 이용 목적</h2>
        <p>수집될 수 있는 정보는 서비스 제공, 문의 응답, 오류 분석, 사이트 보안 유지, 광고 제공, 통계 파악, 사용 경험 개선 등의 목적에 사용될 수 있습니다. GOGIF는 필요한 범위 내에서만 정보를 이용하려고 노력합니다.</p>

        <h2>5. 정보 보관 및 파기</h2>
        <p>문의로 전달된 정보나 로그 정보는 법령, 운영 정책, 보안 필요성에 따라 일정 기간 보관될 수 있으며, 목적이 달성되면 지체 없이 파기하거나 익명화할 수 있습니다. 단, 광고 플랫폼이나 분석 도구에 의해 별도로 수집되는 정보는 해당 제공자의 정책을 따를 수 있습니다.</p>

        <h2>6. 사용자의 권리와 선택</h2>
        <p>사용자는 쿠키를 거부하거나 삭제할 수 있고, 브라우저 설정을 통해 추적 기능을 제한할 수 있습니다. 또한 맞춤형 광고를 원하지 않는 경우 광고 제공자의 설정을 통해 개인 최적화를 해제할 수 있습니다. 문의나 요청이 필요한 경우 아래 이메일로 연락할 수 있습니다.</p>

        <h2>7. 문의처</h2>
        <p>개인정보 관련 문의: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      </div>
    `,
  });
}

function renderTermsPage() {
  return renderStaticPolicyPage({
    eyebrow: "Terms",
    title: "GOGIF 이용약관",
    lead: "GOGIF 서비스의 목적과 사용자 책임, 업로드한 영상 파일 관련 안내, 저작권, 서비스 변경 및 면책 조항을 담은 일반적인 이용약관 초안입니다.",
    body: `
      <div class="prose">
        <p>최종 업데이트: ${UPDATE_DATE_TEXT}</p>
        <h2>1. 서비스 목적</h2>
        <p>GOGIF는 사용자가 동영상을 GIF로 쉽게 변환하고, 그 결과물을 블로그, SNS, 상세페이지, 메신저 등 다양한 환경에서 활용할 수 있도록 돕는 웹 서비스입니다. 본 서비스는 편리한 변환 기능과 함께 설명 콘텐츠를 제공하는 것을 목적으로 합니다.</p>

        <h2>2. 사용자 책임</h2>
        <p>사용자는 서비스 이용 과정에서 업로드하는 콘텐츠가 자신에게 권한이 있는 자료인지 확인해야 합니다. 또한 타인의 권리, 법령, 서비스 정책을 침해하지 않도록 주의해야 하며, 결과물을 외부에 게시하거나 공유할 때도 필요한 책임을 부담합니다.</p>

        <h2>3. 업로드한 영상 파일 관련 안내</h2>
        <p>GOGIF는 가능한 한 브라우저에서 변환을 처리하도록 설계되었습니다. 다만 네트워크 환경, 브라우저 동작 방식, 운영 구조에 따라 파일 처리 과정이 달라질 수 있습니다. 사용자는 민감한 정보나 비공개 자료를 업로드할 때 주의해야 합니다.</p>
        <p>서비스는 업로드된 파일의 영구 저장을 보장하지 않으며, 처리 완료 후 임시 데이터는 삭제되거나 자동으로 정리될 수 있습니다. 그러나 외부 도구나 브라우저 환경에서 생성된 정보는 완전히 통제할 수 없을 수 있습니다.</p>

        <h2>4. 저작권 침해 콘텐츠 업로드 금지</h2>
        <p>사용자는 저작권, 상표권, 초상권, 개인정보, 영업비밀 등 제3자의 권리를 침해하는 콘텐츠를 업로드해서는 안 됩니다. 권리가 불분명한 영상이나 허가받지 않은 자료를 무단으로 변환하거나 배포하는 행위는 금지됩니다.</p>

        <h2>5. 서비스 변경 및 중단</h2>
        <p>GOGIF는 서비스 개선, 기능 수정, 시스템 점검, 정책 변경, 외부 요인 등으로 인해 서비스의 일부 또는 전부를 변경하거나 일시 중단할 수 있습니다. 필요한 경우 사전 고지 없이 기능이 조정될 수 있습니다.</p>

        <h2>6. 면책 조항</h2>
        <p>GOGIF는 서비스가 항상 오류 없이 중단 없이 제공된다고 보장하지 않습니다. 또한 사용자가 서비스 결과를 어떻게 사용하는지에 따른 책임은 사용자에게 있습니다. 사이트에서 제공되는 안내는 일반적인 참고용이며, 법률·의학·재무 등 고위험 분야에 대한 전문 자문으로 해석되어서는 안 됩니다.</p>

        <h2>7. 문의</h2>
        <p>서비스 이용 및 약관 관련 문의: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      </div>
    `,
  });
}

function renderContactPage() {
  return `
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">Contact</span>
        <h1>GOGIF에 문의하기</h1>
        <p class="summary">
          오류 제보, 기능 제안, 광고·제휴 문의, 개인정보 관련 문의는 아래 이메일로 보내 주세요. 문의 폼은 따로 두지 않고 이메일로만 받고 있습니다.
        </p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>문의 이메일</h3>
          <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
        </div>
        <div class="mini-panel">
          <h3>답변이 필요한 항목</h3>
          <p>오류 제보 · 기능 제안 · 광고/제휴 문의 · 개인정보 관련 문의</p>
        </div>
      </div>
    </section>

    <section class="contact-layout">
      <div class="content-card panel fade-in">
        <div class="section-head">
          <div>
            <span class="eyebrow">Guidance</span>
            <h2>어떤 문의를 보내면 좋을까요?</h2>
            <p>짧게 정리해 주시면 확인이 더 빠릅니다.</p>
          </div>
        </div>
        <div class="info-grid">
          <article class="info-card">
            <h3>오류 제보</h3>
            <p>어떤 브라우저에서, 어떤 파일로, 어떤 상황에서 문제가 생겼는지 알려주시면 원인 파악에 도움이 됩니다.</p>
          </article>
          <article class="info-card">
            <h3>기능 제안</h3>
            <p>“이런 설정이 있으면 좋겠다”, “이 페이지가 있으면 더 편하다” 같은 제안은 사이트 개선에 큰 도움이 됩니다.</p>
          </article>
          <article class="info-card">
            <h3>광고/제휴 문의</h3>
            <p>브랜드 소개나 협업 아이디어가 있다면 간단한 개요와 함께 보내 주세요. 검토 후 가능한 범위에서 답변드릴 수 있습니다.</p>
          </article>
          <article class="info-card">
            <h3>개인정보 관련 문의</h3>
            <p>쿠키, 광고, 문의 데이터 처리 등 개인정보와 관련된 궁금증이 있으면 언제든지 문의해 주세요.</p>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderStaticPolicyPage({ eyebrow, title, lead, body }) {
  return `
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p class="summary">${lead}</p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>접근 링크</h3>
          <p>
            <a href="/contact" data-nav>문의 페이지</a> ·
            <a href="/blog" data-nav>블로그</a> ·
            <a href="/about" data-nav>소개</a>
          </p>
        </div>
      </div>
    </section>
    <article class="article-panel panel fade-in">
      ${body}
    </article>
  `;
}

function renderArticlePage({ eyebrow, title, lead, sideTitle, sideParagraphs, sections, relatedLinks = [] }) {
  const toc = sections
    .map((section) => `<a href="#${section.id}">${escapeHtml(section.title)}</a>`)
    .join("");

  const related = relatedLinks.length
    ? `
      <section class="content-card">
        <div class="section-head">
          <div>
            <span class="eyebrow">Next steps</span>
            <h2>다음에 보면 좋은 페이지</h2>
          </div>
        </div>
        <div class="mini-link-row">
          ${relatedLinks.map((link) => `<a class="button secondary" href="${link.path}" data-nav>${escapeHtml(link.label)}</a>`).join("")}
        </div>
      </section>
    `
    : "";

  return `
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p class="summary">${lead}</p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>${sideTitle ?? "목차"}</h3>
          ${sideParagraphs ? sideParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join("") : `<div class="toc">${toc}</div>`}
        </div>
        <div class="mini-panel">
          <h3>내부 링크</h3>
          <div class="mini-link-row">
            <a href="/blog" data-nav>블로그</a>
            <a href="/how-to-use" data-nav>사용법</a>
            <a href="/contact" data-nav>문의</a>
          </div>
        </div>
      </div>
    </section>

    <article class="article-panel panel fade-in">
      <div class="prose">
        <div class="toc">
          <strong>목차</strong>
          ${toc}
        </div>
        ${sections.map((section) => `
          <section id="${section.id}">
            <h2>${section.title}</h2>
            ${section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
          </section>
        `).join("")}
        ${related}
      </div>
    </article>
  `;
}

function renderBlogPostPage({ eyebrow, title, lead, toc, sections }) {
  return `
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">${eyebrow}</span>
        <h1>${title}</h1>
        <p class="summary">${lead}</p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>목차</h3>
          <div class="toc">
            ${toc.map((item) => `<a href="#${item.id}">${item.label}</a>`).join("")}
          </div>
        </div>
        <div class="mini-panel">
          <h3>관련 링크</h3>
          <div class="mini-link-row">
            <a href="/blog" data-nav>블로그 목록</a>
            <a href="/how-to-use" data-nav>사용법</a>
          </div>
        </div>
      </div>
    </section>

    <article class="article-panel panel fade-in">
      <div class="prose">
        ${sections.map((section) => `
          <section id="${section.id}">
            <h2>${section.title}</h2>
            ${section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function makeEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function updateSummary() {
  if (!els.fileCount || !els.validCount || !els.summaryText || !els.zipState) return;
  const total = state.files.length;
  const valid = state.files.filter((entry) => entry.valid).length;
  els.fileCount.textContent = String(total);
  els.validCount.textContent = String(valid);
  els.summaryText.textContent = `선택 ${total}개 · 변환 가능 ${valid}개`;
  if (!state.processing) {
    els.zipState.textContent = state.results.some((item) => item.success) ? "ZIP 가능" : "대기";
  }
}

function updateProgress() {
  if (!els.progressBar || !state.processing) return;
  const overall = state.activeTotal === 0 ? 0 : (state.activeIndex + state.activeProgress) / state.activeTotal;
  const percent = Math.max(0, Math.min(100, overall * 100));
  els.progressBar.value = percent;
  if (els.progressDetail) {
    els.progressDetail.textContent = `${Math.round(percent)}%`;
  }
}

function setControlsDisabled(disabled) {
  if (els.convertBtn) els.convertBtn.disabled = disabled;
  if (els.cancelBtn) els.cancelBtn.disabled = !disabled;
  if (els.clearBtn) els.clearBtn.disabled = disabled;
  if (els.browseBtn) els.browseBtn.disabled = disabled;
  if (els.downloadZipBtn) {
    els.downloadZipBtn.disabled = disabled || !state.results.some((item) => item.success);
  }
}

function setStatus(message) {
  if (els.statusText) {
    els.statusText.textContent = message;
  }
}

function revokeResultUrls() {
  for (const result of state.results) {
    if (result.url) {
      URL.revokeObjectURL(result.url);
    }
  }
}

function renderFiles() {
  if (!els.fileList) return;

  if (state.files.length === 0) {
    els.fileList.innerHTML = makeEmptyState("아직 추가된 파일이 없습니다. 영상을 추가해 주세요.");
    updateSummary();
    return;
  }

  els.fileList.innerHTML = state.files
    .map((entry) => {
      const statusClass =
        entry.status === "완료"
          ? "ok"
          : entry.status === "대기"
            ? "warn"
            : entry.status === "검사 중" || entry.status === "변환 중"
              ? "warn"
              : entry.valid
                ? "ok"
                : "bad";
      const reason = entry.reason ? `<p class="reason">${escapeHtml(entry.reason)}</p>` : "";
      const metaText = entry.meta
        ? `${formatDuration(entry.meta.duration)} · ${entry.meta.width}×${entry.meta.height}`
        : "메타데이터 확인 중";
      return `
        <article class="item-card fade-in">
          <div class="item-top">
            <div class="item-title">
              <strong>${escapeHtml(entry.file.name)}</strong>
              <span>${formatBytes(entry.file.size)} · ${escapeHtml(metaText)}</span>
            </div>
            <span class="badge ${statusClass}">${escapeHtml(entry.status)}</span>
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
          <div class="card-actions">
            <button class="button secondary" type="button" data-remove="${entry.id}">제거</button>
          </div>
        </article>
      `;
    })
    .join("");

  updateSummary();
}

function renderResults() {
  if (!els.resultsList) return;

  const successItems = state.results.filter((item) => item.success);
  if (successItems.length === 0) {
    els.resultsList.innerHTML = makeEmptyState("아직 완성된 GIF가 없습니다. 변환을 시작해 주세요.");
    if (els.downloadZipBtn) els.downloadZipBtn.disabled = true;
    updateSummary();
    return;
  }

  if (els.downloadZipBtn) {
    els.downloadZipBtn.disabled = state.processing || successItems.length === 0;
  }

  els.resultsList.innerHTML = successItems
    .map((item) => `
      <article class="item-card fade-in">
        <div class="item-top">
          <div class="item-title">
            <strong>${escapeHtml(item.outputName)}</strong>
            <span>${formatBytes(item.size)} · 원본 ${escapeHtml(item.sourceName)}</span>
          </div>
          <span class="badge ok">완료</span>
        </div>
        <div class="item-grid">
          <div class="kv">
            <span>최종 용량</span>
            <strong>${formatBytes(item.size)}</strong>
          </div>
          <div class="kv">
            <span>가로 크기</span>
            <strong>${item.width}px</strong>
          </div>
          <div class="kv">
            <span>FPS</span>
            <strong>${item.fps}</strong>
          </div>
          <div class="kv">
            <span>시도 횟수</span>
            <strong>${item.attempts}회</strong>
          </div>
        </div>
        <div class="card-actions">
          <a class="button primary" href="${item.url}" download="${escapeHtml(item.outputName)}">개별 다운로드</a>
        </div>
      </article>
    `)
    .join("");

  updateSummary();
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
  if (els.progressBar) els.progressBar.value = 0;
  if (els.progressDetail) els.progressDetail.textContent = "0%";
  if (els.fileInput) els.fileInput.value = "";
  renderFiles();
  renderResults();
  appendLog("작업 영역을 초기화했습니다.");
}

function appendLog(message) {
  return message;
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
      issues.push("영상 파일 형식이 아닐 수 있습니다.");
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
      entry.reason = meta.duration < 10 ? "짧은 영상일수록 GIF 결과가 더 가볍고 보기 좋습니다." : "";
    } else {
      entry.valid = false;
      entry.status = "제한 초과";
      entry.reason = issues.join(" ");
    }
  } catch (error) {
    entry.meta = null;
    entry.valid = false;
    entry.status = "검사 실패";
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
      appendLog(`[중복 감지] ${file.name}`);
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
  appendLog(`[제거] ${removed.file.name}`);
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
    setStatus("ffmpeg.wasm 불러오는 중...");
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
    // Ignore cleanup errors.
  }
}

async function convertSingle(entry, index, total, settings) {
  const inputExt = entry.file.name.split(".").pop() || "mp4";
  const inputName = `${index}-${slugify(entry.file.name)}-input.${inputExt}`;
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
    appendLog(`[${entry.file.name}] ${attempts}번째 시도 - ${current.width}px / ${current.fps}fps / 색상 ${current.colors}`);

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
        error: "결과 GIF가 비어 있습니다. 원본 파일이나 설정을 다시 확인해 주세요.",
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
        error: "20MB 이하로 줄이지 못했습니다. 조금 더 짧은 구간으로 다시 시도해 주세요.",
      };
    }

    appendLog(`[${entry.file.name}] ${formatBytes(size)}로 제한 초과, 다시 시도합니다.`);
    current = next;
  }

  await safeDelete(inputName);
  return {
    success: false,
    sourceId: entry.id,
    sourceName: entry.file.name,
    error: "자동 시도 횟수를 초과했습니다. 더 짧은 영상으로 다시 시도해 주세요.",
  };
}

async function convertAll() {
  if (state.processing) return;

  await Promise.all(state.files.map((entry) => entry.validationPromise ?? Promise.resolve()));

  const validEntries = state.files.filter((entry) => entry.valid);
  if (validEntries.length === 0) {
    setStatus("변환 가능한 파일이 없습니다.");
    appendLog("먼저 변환 가능한 영상을 추가해 주세요.");
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
  setStatus("GIF 변환 시작");
  if (els.progressBar) els.progressBar.value = 0;
  if (els.progressDetail) els.progressDetail.textContent = "0%";
  if (els.zipState) els.zipState.textContent = "생성 중";
  for (const entry of state.files) {
    if (entry.valid) {
      entry.output = null;
      entry.status = "대기";
      entry.reason = "";
    }
  }
  renderFiles();
  renderResults();
  appendLog("GIF 변환을 시작했습니다.");

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
      if (els.progressBar) els.progressBar.value = percent;
      if (els.progressDetail) els.progressDetail.textContent = `${percent}%`;
      renderFiles();
      renderResults();
    }

    setStatus("변환 완료");
    appendLog("모든 변환이 완료되었습니다.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "예상하지 못한 오류가 발생했습니다.";
    if (message !== "취소됨") {
      appendLog(`[오류] ${message}`);
      setStatus("오류가 발생했습니다.");
      window.alert(message);
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
    if (els.zipState) {
      els.zipState.textContent = state.results.some((item) => item.success) ? "ZIP 가능" : "대기";
    }
  }
}

async function downloadZip() {
  const successItems = state.results.filter((item) => item.success);
  if (successItems.length === 0) {
    window.alert("ZIP으로 묶을 GIF가 없습니다.");
    return;
  }

  if (typeof window.JSZip === "undefined") {
    window.alert("JSZip을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  const zip = new window.JSZip();
  for (const item of successItems) {
    zip.file(item.outputName, item.blob);
  }

  setStatus("ZIP 파일 생성 중");
  appendLog("ZIP 다운로드 파일을 생성 중입니다.");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, `${SITE_NAME}_${new Date().toISOString().slice(0, 10)}.zip`);
  setStatus("ZIP 다운로드 완료");
}

function cancelConversion() {
  if (!state.processing) return;
  state.cancelRequested = true;
  appendLog("취소 요청을 받았습니다. 현재 파일 처리가 끝나면 중단합니다.");
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
  if (els.progressBar) els.progressBar.value = 0;
  if (els.progressDetail) els.progressDetail.textContent = "0%";
  appendLog("FFmpeg 세션을 종료했습니다.");
  setStatus("대기 중");
}

function cacheHomeElements() {
  els = {
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
    progressBar: document.getElementById("progressBar"),
    progressDetail: document.getElementById("progressDetail"),
    statusText: document.getElementById("statusText"),
    summaryText: document.getElementById("summaryText"),
    fileCount: null,
    validCount: null,
    zipState: null,
  };
}

function initializeHome() {
  cacheHomeElements();
  els.fileCount = document.getElementById("fileCount");
  els.validCount = document.getElementById("validCount");
  els.zipState = document.getElementById("zipState");

  if (els.boxValue) els.boxValue.textContent = els.boxRange.value;
  if (els.fpsValue) els.fpsValue.textContent = els.fpsRange.value;
  setStatus("대기 중");
  renderFiles();
  renderResults();
  updateSummary();
  updateProgress();
  bindHomeEvents();
}

function bindHomeEvents() {
  els.browseBtn?.addEventListener("click", () => els.fileInput?.click());
  els.dropzone?.addEventListener("click", () => els.fileInput?.click());
  els.dropzone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.fileInput?.click();
    }
  });

  els.fileInput?.addEventListener("change", (event) => {
    if (event.target.files) {
      addFiles(event.target.files);
    }
    event.target.value = "";
  });

  els.dropzone?.addEventListener("dragenter", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });

  els.dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });

  els.dropzone?.addEventListener("dragleave", (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
  });

  els.dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
    if (event.dataTransfer?.files) {
      addFiles(event.dataTransfer.files);
    }
  });

  els.clearBtn?.addEventListener("click", () => {
    if (state.processing) return;
    resetWorkspace();
  });

  els.convertBtn?.addEventListener("click", () => {
    convertAll();
  });

  els.cancelBtn?.addEventListener("click", () => {
    cancelConversion();
  });

  els.downloadZipBtn?.addEventListener("click", () => {
    downloadZip();
  });

  els.boxRange?.addEventListener("input", () => {
    if (els.boxValue) els.boxValue.textContent = els.boxRange.value;
  });

  els.fpsRange?.addEventListener("input", () => {
    if (els.fpsValue) els.fpsValue.textContent = els.fpsRange.value;
  });

  els.fileList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    removeEntry(button.dataset.remove);
  });
}

function renderHomeRoute() {
  setTitle(ROUTES["/"].title, ROUTES["/"].description);
  app.innerHTML = renderLayout(renderHomePage());
}

function renderConvertPage() {
  return `
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">GIF Converter</span>
        <h1>동영상을 GIF로 바꾸는 전용 변환 페이지</h1>
        <p class="summary">
          업로드, 변환 설정, 다운로드를 한 화면에 모아두었습니다. 설명이 필요하면 사용법 페이지를 참고하고, 바로 작업하고 싶다면 아래에서 파일을 올리세요.
        </p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>빠른 팁</h3>
          <p>짧은 장면, 적당한 해상도, 10~15fps 범위에서 시작하면 대부분 무난합니다.</p>
        </div>
        <div class="mini-panel">
          <h3>관련 페이지</h3>
          <div class="mini-link-row">
            <a href="/how-to-use" data-nav>사용법</a>
            <a href="/blog" data-nav>블로그</a>
          </div>
        </div>
      </div>
    </section>
    ${renderConverterSection()}
  `;
}

function renderConvertRoute() {
  const route = ROUTES["/convert"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
  initializeHome();
}

function renderAboutRoute() {
  const route = ROUTES["/about"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderHowToUseRoute() {
  const route = ROUTES["/how-to-use"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderBlogRoute() {
  const route = ROUTES["/blog"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderGifMakingGuideRoute() {
  const route = ROUTES["/blog/gif-making-guide"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderVideoToGifGuideRoute() {
  const route = ROUTES["/blog/video-to-gif-guide"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderReduceGifSizeRoute() {
  const route = ROUTES["/blog/reduce-gif-size"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderGifForSocialMediaRoute() {
  const route = ROUTES["/blog/gif-for-social-media"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderPrivacyRoute() {
  const route = ROUTES["/privacy"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderTermsRoute() {
  const route = ROUTES["/terms"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderContactRoute() {
  const route = ROUTES["/contact"];
  setTitle(route.title, route.description);
  app.innerHTML = renderLayout(route.render());
}

function renderNotFoundRoute(pathname) {
  const description = `요청하신 ${pathname} 페이지를 찾을 수 없습니다. GOGIF의 주요 페이지로 이동해 주세요.`;
  setTitle(`404 · ${SITE_NAME}`, description);
  app.innerHTML = renderLayout(`
    <section class="page-hero panel fade-in">
      <div class="intro">
        <span class="eyebrow">404</span>
        <h1>페이지를 찾을 수 없습니다</h1>
        <p class="summary">요청한 주소는 현재 사이트에 없지만, 아래 링크로 바로 이동할 수 있습니다.</p>
      </div>
      <div class="sidebar-stack">
        <div class="mini-panel">
          <h3>바로 가기</h3>
          <div class="mini-link-row">
            <a href="/" data-nav>홈</a>
            <a href="/blog" data-nav>블로그</a>
            <a href="/contact" data-nav>문의</a>
          </div>
        </div>
      </div>
    </section>
  `);
}

function renderRoute(pathname) {
  const path = normalizePath(pathname);
  window.scrollTo(0, 0);

  if (path === "/") {
    renderHomeRoute();
  } else if (path === "/convert") {
    renderConvertRoute();
  } else if (path === "/about") {
    renderAboutRoute();
  } else if (path === "/how-to-use") {
    renderHowToUseRoute();
  } else if (path === "/blog") {
    renderBlogRoute();
  } else if (path === "/blog/gif-making-guide") {
    renderGifMakingGuideRoute();
  } else if (path === "/blog/video-to-gif-guide") {
    renderVideoToGifGuideRoute();
  } else if (path === "/blog/reduce-gif-size") {
    renderReduceGifSizeRoute();
  } else if (path === "/blog/gif-for-social-media") {
    renderGifForSocialMediaRoute();
  } else if (path === "/privacy") {
    renderPrivacyRoute();
  } else if (path === "/terms") {
    renderTermsRoute();
  } else if (path === "/contact") {
    renderContactRoute();
  } else {
    renderNotFoundRoute(path);
  }
}

function navigate(path, { replace = false } = {}) {
  const normalized = normalizePath(path);
  if (replace) {
    history.replaceState({}, "", normalized);
  } else {
    history.pushState({}, "", normalized);
  }
  renderRoute(normalized);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-nav]");
  if (!link) return;
  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  if (url.pathname === window.location.pathname && url.hash) return;
  event.preventDefault();
  navigate(url.pathname + url.hash);
});

window.addEventListener("popstate", () => {
  renderRoute(window.location.pathname);
});

function boot() {
  renderRoute(window.location.pathname);
}

boot();
