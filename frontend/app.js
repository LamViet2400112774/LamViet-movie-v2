/* app.js - Fixed all syntax issues */

// Detect API based on environment
const getApiUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3000/api";
  }
  // For production, use Render API URL
  return window.location.origin.includes("vercel") 
    ? "https://moviesite-backend.onrender.com/api"  // Replace with your actual Render URL
    : "http://localhost:3000/api";
};

const API = getApiUrl();
const PHIMAPI = "https://phimapi.com";

/* ===== Helpers ===== */
function safeText(s) { return String(s == null ? "" : s); }

function slugify(s) {
  if (!s) return "";
  return String(s).toLowerCase().trim()
    .replace(/đ/g, "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildImageUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://phimimg.com/${raw.replace(/^\/+/, "")}`;
}

function imgFallback(el) {
  el.onerror = null;
  el.src = "https://via.placeholder.com/300x450?text=No+Image";
}

function q(params) {
  return Object.entries(params)
    .filter(([k, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function extractTotalPages(data) {
  return data?.data?.params?.pagination?.totalPages
    || data?.params?.pagination?.totalPages
    || data?.pagination?.totalPages
    || data?.data?.pagination?.totalPages
    || data?.data?.totalPages
    || data?.totalPages
    || 1;
}

/* ===== State ===== */
let currentPage = 1;
let currentType = "phim-le";
let lastFilter = { kind: "latest", args: {} };

/* ===== Title Map ===== */
const titleMap = {
  "phim-le": "🎬 Phim lẻ",
  "phim-bo": "📺 Phim bộ",
  "tv-shows": "📡 TV Shows",
  "hoat-hinh": "🎨 Hoạt hình",
  "phim-vietsub": "🇻🇳 Phim Vietsub",
  "phim-thuyet-minh": "🎙️ Phim Thuyết minh",
  "phim-long-tieng": "🔊 Phim Lồng tiếng"
};

function updatePageTitle(type, extra) {
  const titleEl = document.getElementById("pageTitle");
  if (!titleEl) return;
  if (extra) {
    titleEl.textContent = extra;
  } else if (type && titleMap[type]) {
    titleEl.textContent = titleMap[type];
  } else {
    titleEl.textContent = "🎬 Phim mới cập nhật";
  }
}

/* ===== Render Movies ===== */
function renderMovies(list) {
  const moviesEl = document.getElementById("movies");
  if (!moviesEl) return;
  moviesEl.innerHTML = "";

  (list || []).forEach(m => {
    const card = document.createElement("div");
    card.className = "movie";
    card.addEventListener("click", () => { if (m && m.slug) goMovie(m.slug); });

    const img = document.createElement("img");
    const imgSrc = buildImageUrl(m.poster_url || m.thumb_url || "");
    img.src = imgSrc || "https://via.placeholder.com/300x450?text=No+Image";
    img.alt = m.name || "";
    img.onerror = function() { imgFallback(this); };

    const h3 = document.createElement("h3");
    h3.textContent = m.name || "";

    card.appendChild(img);
    card.appendChild(h3);
    moviesEl.appendChild(card);
  });

  if (!list || list.length === 0) {
    moviesEl.innerHTML = `<div class="no-results">Không có phim nào.</div>`;
  }
}

/* ===== Render Pagination ===== */
function renderPagination(page, totalPages) {
  const p = document.getElementById("pagination");
  if (!p) return;
  p.innerHTML = "";

  const current = Number(page) || 1;
  const total = Number(totalPages) || 1;

  const prev = document.createElement("button");
  prev.textContent = "⬅ Trang trước";
  prev.disabled = current <= 1;
  prev.addEventListener("click", () => goToPage(current - 1));

  const info = document.createElement("span");
  info.textContent = ` Trang ${current} / ${total} `;
  info.style.margin = "0 12px";

  const next = document.createElement("button");
  next.textContent = "Trang sau ➡";
  next.disabled = current >= total;
  next.addEventListener("click", () => goToPage(current + 1));

  p.appendChild(prev);
  p.appendChild(info);
  p.appendChild(next);
}

/* ===== Navigation ===== */
function goMovie(slug) {
  sessionStorage.setItem("scrollY", window.scrollY);
  const params = new URLSearchParams(location.search);
  const page = params.get("page") || currentPage || 1;
  const type = params.get("type") || currentType;
  let href = `movie.html?slug=${encodeURIComponent(slug)}&fromPage=${page}`;
  if (type) href += `&fromType=${encodeURIComponent(type)}`;
  location.href = href;
}

function goHome() {
  const params = new URLSearchParams(location.search);
  const fromPage = params.get("fromPage") || params.get("page") || 1;
  const fromType = params.get("fromType");
  if (fromType) {
    location.href = `index.html?type=${encodeURIComponent(fromType)}&page=${fromPage}`;
  } else {
    location.href = `index.html?page=${fromPage}`;
  }
}

/* ===== Load Latest (local API) ===== */
function loadLatest(page = 1) {
  currentPage = page;
  lastFilter = { kind: "latest", args: { page } };
  updatePageTitle(null);
  history.replaceState(null, "", `?page=${page}`);

  return fetch(`${API}/latest?page=${page}`)
    .then(res => res.json())
    .then(data => {
      const list = data.items || [];
      renderMovies(list);
      const totalPages = extractTotalPages(data);
      renderPagination(page, totalPages);
      return data;
    })
    .catch(err => {
      console.error(err);
      renderMovies([]);
      renderPagination(1, 1);
      return null;
    });
}

/* ===== Load by Type (phim-le, phim-bo, etc.) ===== */
function loadByType(type, page = 1) {
  currentType = type || currentType;
  currentPage = page;
  lastFilter = { kind: "danh-sach", args: { type: currentType, page } };
  updatePageTitle(currentType);
  history.replaceState(null, "", `?type=${encodeURIComponent(currentType)}&page=${page}`);

  const limit = 24;
  const url = `${PHIMAPI}/v1/api/danh-sach/${encodeURIComponent(currentType)}?page=${page}&limit=${limit}`;

  return fetch(url)
    .then(r => r.json())
    .then(data => {
      const items = data?.data?.items || data?.items || [];
      const totalPages = extractTotalPages(data);
      renderMovies(items);
      renderPagination(page, totalPages);
      return data;
    })
    .catch(err => {
      console.error(err);
      renderMovies([]);
      renderPagination(1, 1);
      return null;
    });
}

function loadList(type) {
  return loadByType(type, 1);
}

/* ===== Search ===== */
function searchMovie(page = 1) {
  const keyword = document.getElementById("searchInput")?.value.trim();
  if (!keyword) return Promise.resolve(null);

  currentPage = page;
  lastFilter = { kind: "search", args: { keyword, page } };
  updatePageTitle(null, `🔍 Kết quả tìm kiếm: "${keyword}"`);
  history.replaceState(null, "", `?type=search&page=${page}&keyword=${encodeURIComponent(keyword)}`);

  const limit = 24;
  const url = `${PHIMAPI}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`;

  return fetch(url)
    .then(r => r.json())
    .then(data => {
      const items = data?.data?.items || data?.items || [];
      const totalPages = extractTotalPages(data);
      renderMovies(items);
      renderPagination(page, totalPages);
      return data;
    })
    .catch(err => {
      console.error(err);
      renderMovies([]);
      renderPagination(1, 1);
      return null;
    });
}

/* ===== Filter: The Loai (Category) ===== */
function fetchTheLoai(args, page = 1) {
  const category = args.category;
  updatePageTitle(null, `🎭 Thể loại: ${category}`);
  const params = {
    page,
    sort_field: args.sortField || "_id",
    sort_type: args.sortType || "desc",
    sort_lang: args.sortLang || "",
    country: args.country || "",
    year: args.year || "",
    limit: args.limit || 24
  };
  const endpoint = `${PHIMAPI}/v1/api/the-loai/${encodeURIComponent(category)}?${q(params)}`;

  lastFilter = { kind: "the-loai", args: Object.assign({}, args, { page }) };
  history.replaceState(null, "", `?type=the-loai&category=${encodeURIComponent(category)}&page=${page}`);

  return fetch(endpoint)
    .then(r => r.json())
    .then(data => {
      const items = data?.data?.items || data?.items || [];
      const totalPages = extractTotalPages(data);
      renderMovies(items);
      renderPagination(page, totalPages);
      return data;
    })
    .catch(err => {
      console.error(err);
      renderMovies([]);
      renderPagination(1, 1);
      return null;
    });
}

/* ===== Filter: Quoc Gia (Country) ===== */
function fetchQuocGia(args, page = 1) {
  const country = args.country;
  updatePageTitle(null, `🌍 Quốc gia: ${country}`);
  const params = {
    page,
    sort_field: args.sortField || "_id",
    sort_type: args.sortType || "desc",
    sort_lang: args.sortLang || "",
    category: args.category || "",
    year: args.year || "",
    limit: args.limit || 24
  };
  const endpoint = `${PHIMAPI}/v1/api/quoc-gia/${encodeURIComponent(country)}?${q(params)}`;

  lastFilter = { kind: "quoc-gia", args: Object.assign({}, args, { page }) };
  history.replaceState(null, "", `?type=quoc-gia&country=${encodeURIComponent(country)}&page=${page}`);

  return fetch(endpoint)
    .then(r => r.json())
    .then(data => {
      const items = data?.data?.items || data?.items || [];
      const totalPages = extractTotalPages(data);
      renderMovies(items);
      renderPagination(page, totalPages);
      return data;
    })
    .catch(err => {
      console.error(err);
      renderMovies([]);
      renderPagination(1, 1);
      return null;
    });
}

/* ===== Filter: Nam (Year) ===== */
function fetchNam(args, page = 1) {
  const year = args.year;
  updatePageTitle(null, `📅 Năm: ${year}`);
  const params = {
    page,
    sort_field: args.sortField || "_id",
    sort_type: args.sortType || "desc",
    sort_lang: args.sortLang || "",
    category: args.category || "",
    country: args.country || "",
    limit: args.limit || 24
  };
  const endpoint = `${PHIMAPI}/v1/api/nam/${encodeURIComponent(year)}?${q(params)}`;

  lastFilter = { kind: "nam", args: Object.assign({}, args, { page }) };
  history.replaceState(null, "", `?type=nam&year=${encodeURIComponent(year)}&page=${page}`);

  return fetch(endpoint)
    .then(r => r.json())
    .then(data => {
      const items = data?.data?.items || data?.items || [];
      const totalPages = extractTotalPages(data);
      renderMovies(items);
      renderPagination(page, totalPages);
      return data;
    })
    .catch(err => {
      console.error(err);
      renderMovies([]);
      renderPagination(1, 1);
      return null;
    });
}

/* ===== Apply Filter ===== */
function applyFilter(page = 1) {
  const category = document.getElementById("category")?.value || "";
  const country = document.getElementById("country")?.value || "";
  const year = document.getElementById("year")?.value || "";
  const sortField = document.getElementById("sortField")?.value || "_id";
  const sortType = document.getElementById("sortType")?.value || "desc";
  const sortLang = document.getElementById("sortLang")?.value || "";
  const limit = 24;

  const args = { category, country, year, sortField, sortType, sortLang, limit };

  if (category) return fetchTheLoai(args, page);
  if (country) return fetchQuocGia(args, page);
  if (year) return fetchNam(args, page);
  return loadByType(currentType, page);
}

/* ===== Pagination Handler ===== */
function goToPage(page) {
  page = Math.max(1, page);
  currentPage = page;
  window.scrollTo(0, 0);
  const k = lastFilter.kind;
  const a = lastFilter.args || {};

  if (k === "latest") return loadLatest(page);
  if (k === "danh-sach") return loadByType(a.type || currentType, page);
  if (k === "search") return searchMovie(page);
  if (k === "the-loai") return fetchTheLoai(a, page);
  if (k === "quoc-gia") return fetchQuocGia(a, page);
  if (k === "nam") return fetchNam(a, page);

  return loadLatest(page);
}

/* ===== Filter Options Loader ===== */
function safeListFromResponse(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  return [];
}

function loadFilterOptions() {
  const catEl = document.getElementById("category");
  const countryEl = document.getElementById("country");
  const yearEl = document.getElementById("year");

  if (catEl) {
    fetch(`${PHIMAPI}/the-loai`)
      .then(r => r.json())
      .then(json => {
        const arr = safeListFromResponse(json);
        arr.forEach(item => {
          const slug = item.slug || item._id || "";
          const name = item.name || slug;
          if (!slug) return;
          const opt = document.createElement("option");
          opt.value = slug;
          opt.textContent = name;
          catEl.appendChild(opt);
        });
      })
      .catch(err => console.error("Failed to load categories", err));
  }

  if (countryEl) {
    fetch(`${PHIMAPI}/quoc-gia`)
      .then(r => r.json())
      .then(json => {
        const arr = safeListFromResponse(json);
        arr.forEach(item => {
          const slug = item.slug || item._id || "";
          const name = item.name || slug;
          if (!slug) return;
          const opt = document.createElement("option");
          opt.value = slug;
          opt.textContent = name;
          countryEl.appendChild(opt);
        });
      })
      .catch(err => console.error("Failed to load countries", err));
  }

  if (yearEl) {
    const current = new Date().getFullYear();
    for (let y = current; y >= 1970; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearEl.appendChild(opt);
    }
  }
}

/* ===== Movie Detail ===== */
function renderMovieDetail(movie, episodes) {
  const detailEl = document.getElementById("detail");
  if (!detailEl) return;

  const title = safeText(movie.name);
  const origin = safeText(movie.origin_name);
  const year = safeText(movie.year);
  const time = safeText(movie.time);
  const quality = safeText(movie.quality);
  const lang = safeText(movie.lang);
  const content = safeText(movie.content);
  const poster = buildImageUrl(movie.poster_url || movie.thumb_url || "");

  let genres = movie.category || movie.genre || movie.genres || [];
  if (!Array.isArray(genres)) genres = [genres];
  genres = genres.map(g => {
    if (!g) return null;
    if (typeof g === "string") return { slug: slugify(g), name: g };
    return { slug: g.slug || slugify(g.name || ""), name: g.name || "" };
  }).filter(Boolean);

  let countries = movie.country || movie.countries || [];
  if (!Array.isArray(countries)) countries = [countries];
  countries = countries.map(c => {
    if (!c) return null;
    if (typeof c === "string") return { slug: slugify(c), name: c };
    return { slug: c.slug || slugify(c.name || ""), name: c.name || "" };
  }).filter(Boolean);

  detailEl.innerHTML = `
    <div class="detail-top" style="display: flex;gap:20px;flex-wrap:wrap">
      <img id="detail-poster" src="${poster}" alt="${title}" style="width: 220px;border-radius:8px">
      <div class="meta" style="flex:1;min-width:220px">
        <h1 style="margin:0 0 8px">${title}</h1>
        <div><b>Tên gốc:</b> ${origin}</div>
        <div><b>Năm:</b> <span class="year-link" style="cursor:pointer;color:#007bff" onclick="filterByYear('${year}')">${year}</span></div>
        <div><b>Thời lượng:</b> ${time}</div>
        <div><b>Chất lượng:</b> ${quality} - ${lang}</div>
        <div style="margin-top:8px"><b>Mô tả:</b><div style="margin-top:6px">${content}</div></div>
        <div style="margin-top:8px"><b>Thể loại:</b> <span id="genre-tags"></span></div>
        <div style="margin-top:6px"><b>Quốc gia: </b> <span id="country-tags"></span></div>
      </div>
    </div>
  `;

  const posterImg = document.getElementById("detail-poster");
  if (posterImg) posterImg.onerror = function() { imgFallback(this); };

  const genreContainer = document.getElementById("genre-tags");
  genres.forEach(g => {
    const span = document.createElement("span");
    span.textContent = g.name;
    span.style = "cursor:pointer;color:#007bff;margin-right:8px";
    span.addEventListener("click", () => filterByCategory(g.slug));
    genreContainer.appendChild(span);
  });

  const countryContainer = document.getElementById("country-tags");
  countries.forEach(c => {
    const span = document.createElement("span");
    span.textContent = c.name;
    span.style = "cursor:pointer;color:#007bff;margin-right: 8px";
    span.addEventListener("click", () => filterByCountry(c.slug));
    countryContainer.appendChild(span);
  });

  const episodesEl = document.getElementById("episodes");
  if (!episodesEl) return;

  let html = "";
  let firstLink = null;
  (episodes || []).forEach(server => {
    html += `<h4>${server.server_name || "Server"}</h4><div class="episode-list" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">`;
    (server.server_data || []).forEach(ep => {
      const link = ep.link_embed || ep.link || "";
      if (!firstLink && link) firstLink = link;
      html += `<button class="episode-btn" data-link="${link}" style="padding:6px 8px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">${safeText(ep.name || "Tập")}</button>`;
    });
    html += `</div>`;
  });
  episodesEl.innerHTML = html;

  document.querySelectorAll(".episode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove active class from all buttons
      document.querySelectorAll(".episode-btn").forEach(b => b.classList.remove("active"));
      // Add active class to clicked button
      btn.classList.add("active");
      playEpisode(btn.dataset.link);
    });
  });

  if (firstLink) {
    // Set first button as active
    const firstBtn = document.querySelector(".episode-btn");
    if (firstBtn) firstBtn.classList.add("active");
    playEpisode(firstLink);
  }
  else {
    const player = document.getElementById("player");
    if (player) player.innerHTML = "<p>Phim chưa có tập</p>";
  }
}

/* ===== Filter from Detail ===== */
function filterByCategory(slug) {
  location.href = `index.html?type=the-loai&category=${encodeURIComponent(slug)}&page=1`;
}
function filterByCountry(slug) {
  location.href = `index.html?type=quoc-gia&country=${encodeURIComponent(slug)}&page=1`;
}
function filterByYear(year) {
  location.href = `index.html?type=nam&year=${encodeURIComponent(year)}&page=1`;
}

/* ===== Player ===== */
function playEpisode(url) {
  const player = document.getElementById("player");
  if (!player) return;
  if (!url) { player.innerHTML = "<p>Link không hợp lệ</p>"; return; }
  player.innerHTML = `<iframe src="${url}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`;
}

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadFilterOptions();

  // Home/List page
  if (document.getElementById("movies")) {
    const params = new URLSearchParams(location.search);
    const page = parseInt(params.get("page")) || 1;
    const type = params.get("type");
    const keyword = params.get("keyword");
    const category = params.get("category");
    const country = params.get("country");
    const year = params.get("year");

    let loader;

    if (type === "the-loai" && category) {
      loader = fetchTheLoai({ category, country: "", year: "", limit: 24 }, page);
    } else if (type === "quoc-gia" && country) {
      loader = fetchQuocGia({ country, category: "", year: "", limit: 24 }, page);
    } else if (type === "nam" && year) {
      loader = fetchNam({ year, category: "", country: "", limit: 24 }, page);
    } else if (type === "search" || keyword) {
      if (keyword) document.getElementById("searchInput").value = keyword;
      loader = searchMovie(page);
    } else if (type && type !== "search") {
      loader = loadByType(type, page);
    } else {
      loader = loadLatest(page);
    }

    loader.then(() => {
      const savedY = sessionStorage.getItem("scrollY");
      if (savedY) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedY));
          sessionStorage.removeItem("scrollY");
        }, 150);
      }
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); searchMovie(); }
      });
    }
  }

  // Movie Detail page
  if (location.pathname.includes("movie.html")) {
    const params = new URLSearchParams(location.search);
    const slug = params.get("slug");
    if (!slug) { location.href = "index.html"; return; }

    fetch(`${API}/movie/${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        const movie = data.movie || {};
        const episodes = data.episodes || [];
        renderMovieDetail(movie, episodes);
      })
      .catch(err => {
        console.error(err);
        const detail = document.getElementById("detail");
        if (detail) detail.innerHTML = "<p>Không thể tải dữ liệu phim.</p>";
      });
  }
});

/* ===== Expose to global ===== */
window.loadList = loadList;
window.loadByType = loadByType;
window.applyFilter = applyFilter;
window.searchMovie = searchMovie;
window.goHome = goHome;
window.goMovie = goMovie;
window.playEpisode = playEpisode;
window.filterByCategory = filterByCategory;
window.filterByCountry = filterByCountry;
window.filterByYear = filterByYear;