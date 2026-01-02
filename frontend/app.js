/* app.js - Fixed all syntax issues */

// Detect API based on environment
const getApiUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3000/api";
  }
  // For production, use Render API URL
  return window.location.origin.includes("vercel") 
    ? "https://lamviet-movie-v2.onrender.com/api"  // Replace with your actual Render URL
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

function getTypeDisplayName(type) {
  const typeMap = {
    "phim-le": "Phim lẻ",
    "phim-bo": "Phim bộ",
    "tv-shows": "TV Shows",
    "hoat-hinh": "Hoạt hình",
    "phim-vietsub": "Vietsub",
    "phim-thuyet-minh": "Thuyết minh",
    "phim-long-tieng": "Lồng tiếng"
  };
  return typeMap[type] || type;
}

function filterByType(items, type) {
  if (!type || !items || items.length === 0) return items;
  
  // Map type to slug format used in API
  const typeSlug = type.toLowerCase().replace(/\s+/g, "-");
  
  return items.filter(item => {
    const itemType = (item.type || "").toLowerCase();
    const itemSlug = slugify(item.type || "");
    
    // Match by type slug
    if (itemSlug === typeSlug || itemType === typeSlug) return true;
    
    // Special matching
    if (type === "phim-le" && (itemType === "single" || itemType.includes("lẻ") || itemType.includes("le"))) return true;
    if (type === "phim-bo" && (itemType === "series" || itemType.includes("bộ") || itemType.includes("bo"))) return true;
    if (type === "tv-shows" && (itemType.includes("tv") || itemType.includes("show"))) return true;
    if (type === "hoat-hinh" && (itemType.includes("hoat") || itemType.includes("cartoon") || itemType.includes("anime"))) return true;
    
    return false;
  });
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
let currentType = null; // Don't default to phim-le, let URL determine
let lastFilter = { kind: "latest", args: {} };
let isPopState = false; // Flag to prevent pushState during popstate
let episodeButtons = [];
let activeEpisodeIndex = -1;

/* ===== Title Map ===== */
const titleMap = {
  "phim-le": "🎬 Phim lẻ",
  "phim-bo": "📺 Phim bộ",
  "tv-shows": "📡 TV Shows",
  "hoat-hinh": "🎨 Hoạt hình",
  "phim-chieu-rap": "🎥 Phim chiếu rạp",
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

  (list || []).forEach((m, index) => {
    const card = document.createElement("div");
    card.className = "movie";
    card.addEventListener("click", () => { if (m && m.slug) goMovie(m.slug); });

    const img = document.createElement("img");
    const imgSrc = buildImageUrl(m.poster_url || m.thumb_url || "");
    
    // Load tất cả ảnh ngay lập tức
    img.src = imgSrc || "https://via.placeholder.com/300x450?text=No+Image";
    img.loading = "eager";
    // Ưu tiên cao cho 8 ảnh đầu
    if (index < 8) img.fetchPriority = "high";
    
    img.alt = m.name || "";
    img.width = 300;
    img.height = 450;
    img.decoding = "async";
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

  // Nút Previous (<)
  const prev = document.createElement("button");
  prev.textContent = "<";
  prev.disabled = current <= 1;
  prev.addEventListener("click", () => goToPage(current - 1));
  p.appendChild(prev);

  // Logic hiển thị số trang
  const createPageBtn = (pageNum) => {
    const btn = document.createElement("button");
    btn.textContent = pageNum;
    if (pageNum === current) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => goToPage(pageNum));
    return btn;
  };

  const createEllipsis = () => {
    const span = document.createElement("button");
    span.textContent = "...";
    span.disabled = true;
    span.classList.add("ellipsis");
    return span;
  };

  if (total <= 7) {
    // Hiển thị tất cả nếu ít trang
    for (let i = 1; i <= total; i++) {
      p.appendChild(createPageBtn(i));
    }
  } else {
    // Luôn hiển thị trang 1
    p.appendChild(createPageBtn(1));

    if (current > 4) {
      p.appendChild(createEllipsis());
    }

    // Các trang xung quanh trang hiện tại (hiển thị 2 trang trước và 2 trang sau)
    let start = Math.max(2, current - 2);
    let end = Math.min(total - 1, current + 2);

    // Nếu đang ở đầu (trang 1-4)
    if (current <= 4) {
      start = 2;
      end = Math.min(6, total - 1);
    }

    // Nếu đang ở cuối
    if (current >= total - 3) {
      start = Math.max(2, total - 5);
      end = total - 1;
    }

    for (let i = start; i <= end; i++) {
      p.appendChild(createPageBtn(i));
    }

    if (current < total - 3) {
      p.appendChild(createEllipsis());
    }

    // Luôn hiển thị trang cuối
    p.appendChild(createPageBtn(total));
  }

  // Nút Next (>)
  const next = document.createElement("button");
  next.textContent = ">";
  next.disabled = current >= total;
  next.addEventListener("click", () => goToPage(current + 1));
  p.appendChild(next);
}

/* ===== Navigation ===== */
function goMovie(slug) {
  // Save current scroll position and full URL for back navigation
  sessionStorage.setItem("scrollY", window.scrollY);
  sessionStorage.setItem("lastIndexURL", location.search); // Save the full query string
  
  const params = new URLSearchParams(location.search);
  const page = params.get("page") || currentPage || 1;
  const type = params.get("type") || currentType;
  let href = `movie.html?slug=${encodeURIComponent(slug)}&fromPage=${page}`;
  if (type) href += `&fromType=${encodeURIComponent(type)}`;
  location.href = href;
}

function goHome() {
  // Clear any stored URL and go to homepage page 1
  sessionStorage.removeItem("lastIndexURL");
  sessionStorage.removeItem("scrollY");
  location.href = "index.html?page=1";
}

/* ===== Fetch DanhSach with Filter (country/year) - API supports this natively! ===== */
function fetchDanhSachWithFilter(type, args, page = 1) {
  const { country, year, sortField, sortType, sortLang, limit } = args;
  
  // Build title
  let titleParts = [getTypeDisplayName(type)];
  if (country) titleParts.push(`Quốc gia: ${country}`);
  if (year) titleParts.push(`Năm: ${year}`);
  updatePageTitle(null, titleParts.join(' - '));
  
  // Build API URL with filter params
  const params = {
    page,
    limit: limit || 24,
    sort_field: sortField || "modified.time",
    sort_type: sortType || "desc"
  };
  if (country) params.country = country;
  if (year) params.year = year;
  if (sortLang) params.sort_lang = sortLang;
  
  const endpoint = `${PHIMAPI}/v1/api/danh-sach/${encodeURIComponent(type)}?${q(params)}`;
  
  // Save filter state
  lastFilter = { kind: "danh-sach-filter", args: { type, country, year, sortField, sortType, sortLang, limit, page } };
  
  // Build URL params
  let urlParams = `?type=${encodeURIComponent(type)}&page=${page}`;
  if (country) urlParams += `&country=${encodeURIComponent(country)}`;
  if (year) urlParams += `&year=${encodeURIComponent(year)}`;
  if (sortLang) urlParams += `&lang=${encodeURIComponent(sortLang)}`;
  if (!isPopState) history.pushState(null, "", urlParams);
  
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

/* ===== Load Latest (local API) ===== */
function loadLatest(page = 1) {
  currentPage = page;
  lastFilter = { kind: "latest", args: { page } };
  updatePageTitle(null);
  if (!isPopState) history.pushState(null, "", `?page=${page}`);

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
  
  // Get current filter values
  const category = document.getElementById("category")?.value || "";
  const country = document.getElementById("country")?.value || "";
  const year = document.getElementById("year")?.value || "";
  const sortLang = document.getElementById("sortLang")?.value || "";
  
  // If filters are active, use them with the type
  if (category || country || year || sortLang) {
    return applyFilter(page);
  }
  
  lastFilter = { kind: "danh-sach", args: { type: currentType, page } };
  updatePageTitle(currentType);
  if (!isPopState) history.pushState(null, "", `?type=${encodeURIComponent(currentType)}&page=${page}`);

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

/* ===== Load Phim Chiếu Rạp ===== */
function loadPhimChieuRap(page = 1) {
  currentType = "phim-chieu-rap";
  currentPage = page;
  
  // Clear filters when loading phim chieu rap
  const categoryEl = document.getElementById("category");
  const countryEl = document.getElementById("country");
  const yearEl = document.getElementById("year");
  const sortLangEl = document.getElementById("sortLang");
  if (categoryEl) categoryEl.value = "";
  if (countryEl) countryEl.value = "";
  if (yearEl) yearEl.value = "";
  if (sortLangEl) sortLangEl.value = "";
  
  lastFilter = { kind: "phim-chieu-rap", args: { page } };
  updatePageTitle("phim-chieu-rap");
  if (!isPopState) history.pushState(null, "", `?type=phim-chieu-rap&page=${page}`);

  const limit = 24;
  // API endpoint riêng cho phim chiếu rạp
  const url = `${PHIMAPI}/v1/api/danh-sach/phim-chieu-rap?page=${page}&limit=${limit}`;

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

/* ===== Search ===== */
function searchMovie(page = 1) {
  const keyword = document.getElementById("searchInput")?.value.trim();
  if (!keyword) return Promise.resolve(null);

  currentPage = page;
  lastFilter = { kind: "search", args: { keyword, page } };
  updatePageTitle(null, `🔍 Kết quả tìm kiếm: "${keyword}"`);
  if (!isPopState) history.pushState(null, "", `?type=search&page=${page}&keyword=${encodeURIComponent(keyword)}`);

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
  const titleSuffix = currentType ? ` - ${getTypeDisplayName(currentType)}` : '';
  updatePageTitle(null, `🎭 Thể loại: ${category}${titleSuffix}`);
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
  
  let urlParams = `?type=the-loai&category=${encodeURIComponent(category)}&page=${page}`;
  if (currentType) urlParams += `&navType=${encodeURIComponent(currentType)}`;
  if (!isPopState) history.pushState(null, "", urlParams);

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
  const titleSuffix = currentType ? ` - ${getTypeDisplayName(currentType)}` : '';
  updatePageTitle(null, `🌍 Quốc gia: ${country}${titleSuffix}`);
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
  
  let urlParams = `?type=quoc-gia&country=${encodeURIComponent(country)}&page=${page}`;
  if (currentType) urlParams += `&navType=${encodeURIComponent(currentType)}`;
  if (!isPopState) history.pushState(null, "", urlParams);

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
  const titleSuffix = currentType ? ` - ${getTypeDisplayName(currentType)}` : '';
  updatePageTitle(null, `📅 Năm: ${year}${titleSuffix}`);
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
  
  let urlParams = `?type=nam&year=${encodeURIComponent(year)}&page=${page}`;
  if (currentType) urlParams += `&navType=${encodeURIComponent(currentType)}`;
  if (!isPopState) history.pushState(null, "", urlParams);

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
  
  // If currentType is set, use danh-sach endpoint with filter params (API supports this!)
  if (currentType && (country || year)) {
    return fetchDanhSachWithFilter(currentType, args, page);
  }
  
  // Build URL - DO NOT duplicate type parameter
  let urlParams = `?page=${page}`;
  
  if (category) {
    urlParams += `&type=the-loai&category=${encodeURIComponent(category)}`;
    if (currentType) urlParams += `&navType=${encodeURIComponent(currentType)}`;
  } else if (country) {
    urlParams += `&type=quoc-gia&country=${encodeURIComponent(country)}`;
  } else if (year) {
    urlParams += `&type=nam&year=${encodeURIComponent(year)}`;
  } else if (currentType) {
    urlParams += `&type=${encodeURIComponent(currentType)}`;
  }
  
  if (sortLang) urlParams += `&lang=${encodeURIComponent(sortLang)}`;
  if (!isPopState) history.pushState(null, "", urlParams);

  if (category) return fetchTheLoai(args, page);
  if (country) return fetchQuocGia(args, page);
  if (year) return fetchNam(args, page);
  
  // If only type is selected (no specific filters)
  if (currentType) {
    lastFilter = { kind: "danh-sach", args: { type: currentType, page } };
    updatePageTitle(currentType);
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
  
  return loadLatest(page);
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
  if (k === "danh-sach-filter") return fetchDanhSachWithFilter(a.type || currentType, a, page);
  if (k === "phim-chieu-rap") return loadPhimChieuRap(page);
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

/* ===== Episode Navigation ===== */
function updateEpisodeNav() {
  const prevBtn = document.getElementById("prevEpisode");
  const nextBtn = document.getElementById("nextEpisode");
  const status = document.getElementById("episodeStatus");
  const total = episodeButtons.length;

  if (prevBtn) prevBtn.disabled = activeEpisodeIndex <= 0;
  if (nextBtn) nextBtn.disabled = activeEpisodeIndex >= total - 1;
  if (status) status.textContent = total > 0 ? `Tập ${activeEpisodeIndex + 1}/${total}` : "0/0";
}

function selectEpisode(index) {
  if (index < 0 || index >= episodeButtons.length) return;
  
  episodeButtons.forEach(b => b.classList.remove("active"));
  episodeButtons[index].classList.add("active");
  activeEpisodeIndex = index;
  
  const label = episodeButtons[index].textContent || `Tập ${index + 1}`;
  const info = document.getElementById("episodeInfo");
  if (info) info.innerHTML = `<strong style="color: var(--primary);">${label}</strong>`;
  
  playEpisode(episodeButtons[index].dataset.link);
  updateEpisodeNav();
}

function initEpisodeNav() {
  const prevBtn = document.getElementById("prevEpisode");
  const nextBtn = document.getElementById("nextEpisode");
  
  if (prevBtn) prevBtn.onclick = () => selectEpisode(activeEpisodeIndex - 1);
  if (nextBtn) nextBtn.onclick = () => selectEpisode(activeEpisodeIndex + 1);
  
  updateEpisodeNav();
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
  (episodes || []).forEach(server => {
    html += `<h4>${server.server_name || "Server"}</h4><div class="episode-list" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">`;
    (server.server_data || []).forEach(ep => {
      const link = ep.link_embed || ep.link || "";
      html += `<button class="episode-btn" data-link="${link}" style="padding:6px 8px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer">${safeText(ep.name || "Tập")}</button>`;
    });
    html += `</div>`;
  });
  episodesEl.innerHTML = html;

  episodeButtons = Array.from(document.querySelectorAll(".episode-btn"));
  episodeButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => selectEpisode(index));
  });

  initEpisodeNav();

  if (episodeButtons.length > 0) {
    selectEpisode(0);
  } else {
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
    // Check if we're coming back from movie.html
    const lastIndexURL = sessionStorage.getItem("lastIndexURL");
    let searchStr = location.search;
    
    if (lastIndexURL && !location.search) {
      // Restore the previous URL and use it for parsing
      searchStr = lastIndexURL;
      history.replaceState(null, "", `index.html${lastIndexURL}`);
      sessionStorage.removeItem("lastIndexURL");
    } else {
      // Clear the stored URL if we have a search string
      sessionStorage.removeItem("lastIndexURL");
    }
    
    const params = new URLSearchParams(searchStr);
    const page = parseInt(params.get("page")) || 1;
    const type = params.get("type");
    const keyword = params.get("keyword");
    const category = params.get("category");
    const country = params.get("country");
    const year = params.get("year");
    const lang = params.get("lang");
    const navType = params.get("navType"); // Get navType from URL
    
    // Restore filter values from URL
    if (category) {
      const categoryEl = document.getElementById("category");
      if (categoryEl) categoryEl.value = category;
    }
    if (country) {
      const countryEl = document.getElementById("country");
      if (countryEl) countryEl.value = country;
    }
    if (year) {
      const yearEl = document.getElementById("year");
      if (yearEl) yearEl.value = year;
    }
    if (lang) {
      const sortLangEl = document.getElementById("sortLang");
      if (sortLangEl) sortLangEl.value = lang;
    }
    
    // Set currentType from navType first, then type
    if (navType) {
      currentType = navType;
    } else if (type && type !== "search" && type !== "the-loai" && type !== "quoc-gia" && type !== "nam" && type !== "phim-chieu-rap") {
      currentType = type;
    } else {
      currentType = null; // No default type
    }

    let loader;
    
    // Check if it's a nav type (like hoat-hinh) with filter params
    const isNavType = type && !["search", "the-loai", "quoc-gia", "nam", "phim-chieu-rap"].includes(type);
    
    if (type === "phim-chieu-rap") {
      loader = loadPhimChieuRap(page);
    } else if (isNavType && (country || year)) {
      // Using danh-sach endpoint with filter
      currentType = type;
      const args = { country: country || "", year: year || "", limit: 24 };
      loader = fetchDanhSachWithFilter(type, args, page);
    } else if (type === "the-loai" && category) {
      loader = fetchTheLoai({ category, country: "", year: "", limit: 24 }, page);
    } else if (type === "quoc-gia" && country) {
      loader = fetchQuocGia({ country, category: "", year: "", limit: 24 }, page);
    } else if (type === "nam" && year) {
      loader = fetchNam({ year, category: "", country: "", limit: 24 }, page);
    } else if (type === "search" || keyword) {
      if (keyword) document.getElementById("searchInput").value = keyword;
      loader = searchMovie(page);
    } else if (type && type !== "search") {
      currentType = type;
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
    
    // Auto-apply filters when selection changes
    const categoryEl = document.getElementById("category");
    const countryEl = document.getElementById("country");
    const yearEl = document.getElementById("year");
    const sortLangEl = document.getElementById("sortLang");
    
    if (categoryEl) categoryEl.addEventListener("change", () => applyFilter(1));
    if (countryEl) countryEl.addEventListener("change", () => applyFilter(1));
    if (yearEl) yearEl.addEventListener("change", () => applyFilter(1));
    if (sortLangEl) sortLangEl.addEventListener("change", () => applyFilter(1));
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

/* ===== Handle browser back/forward buttons ===== */
window.addEventListener("popstate", (event) => {
  // Only handle if we're on the movies list page
  if (!document.getElementById("movies")) return;
  
  // Set flag to prevent pushState during popstate handling
  isPopState = true;
  
  const params = new URLSearchParams(location.search);
  const page = parseInt(params.get("page")) || 1;
  const type = params.get("type");
  const keyword = params.get("keyword");
  const category = params.get("category");
  const country = params.get("country");
  const year = params.get("year");
  const navType = params.get("navType");
  const lang = params.get("lang");
  
  // Clear filter dropdowns first
  const categoryEl = document.getElementById("category");
  const countryEl = document.getElementById("country");
  const yearEl = document.getElementById("year");
  const langEl = document.getElementById("sortLang");
  if (categoryEl) categoryEl.value = "";
  if (countryEl) countryEl.value = "";
  if (yearEl) yearEl.value = "";
  if (langEl) langEl.value = "";
  
  // Restore currentType from navType if exists
  if (navType) {
    currentType = navType;
  } else if (type && type !== "search" && type !== "the-loai" && type !== "quoc-gia" && type !== "nam") {
    currentType = type;
  } else {
    currentType = null;
  }
  
  // Restore filter dropdown values
  if (category) {
    const categoryEl = document.getElementById("category");
    if (categoryEl) categoryEl.value = category;
  }
  if (country) {
    const countryEl = document.getElementById("country");
    if (countryEl) countryEl.value = country;
  }
  if (year) {
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.value = year;
  }
  if (lang) {
    const langEl = document.getElementById("sortLang");
    if (langEl) langEl.value = lang;
  }
  
  // Load the appropriate content
  let loader;
  
  // Check if it's a type with filter params (e.g., hoat-hinh with country/year)
  const isNavType = type && !["search", "the-loai", "quoc-gia", "nam", "phim-chieu-rap"].includes(type);
  
  if (type === "phim-chieu-rap") {
    loader = loadPhimChieuRap(page);
  } else if (isNavType && (country || year)) {
    // Using danh-sach endpoint with filter
    currentType = type;
    const args = { country: country || "", year: year || "", limit: 24 };
    loader = fetchDanhSachWithFilter(type, args, page);
  } else if (type === "the-loai" && category) {
    loader = fetchTheLoai({ category, country: "", year: "", limit: 24 }, page);
  } else if (type === "quoc-gia" && country) {
    loader = fetchQuocGia({ country, category: "", year: "", limit: 24 }, page);
  } else if (type === "nam" && year) {
    loader = fetchNam({ year, category: "", country: "", limit: 24 }, page);
  } else if (type === "search" || keyword) {
    if (keyword) {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.value = keyword;
    }
    loader = searchMovie(page);
  } else if (type && type !== "search") {
    loader = loadByType(type, page);
  } else {
    loader = loadLatest(page);
  }
  
  // Reset isPopState flag after loading completes
  if (loader && loader.then) {
    loader.then(() => { isPopState = false; }).catch(() => { isPopState = false; });
  } else {
    isPopState = false;
  }
});

/* ===== Expose to global ===== */
window.loadList = loadList;
window.loadByType = loadByType;
window.loadPhimChieuRap = loadPhimChieuRap;
window.applyFilter = applyFilter;
window.searchMovie = searchMovie;
window.goHome = goHome;
window.goMovie = goMovie;
window.playEpisode = playEpisode;
window.filterByCategory = filterByCategory;
window.filterByCountry = filterByCountry;
window.filterByYear = filterByYear;