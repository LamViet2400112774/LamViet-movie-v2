/* auth.js - Xử lý đăng nhập/đăng ký với MongoDB */

const AUTH_API = getApiUrl() + '/user';

/* ===== Auth State ===== */
let currentUser = null;

/* ===== Toggle Password Visibility ===== */
function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}

/* ===== Token Management ===== */
function getToken() {
  return localStorage.getItem('authToken');
}

function setToken(token) {
  localStorage.setItem('authToken', token);
}

function removeToken() {
  localStorage.removeItem('authToken');
}

function getAuthHeaders() {
  const token = getToken();
  return token 
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } 
    : { 'Content-Type': 'application/json' };
}

/* ===== User State ===== */
function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('currentUser', JSON.stringify(user));
  updateAuthUI();
}

function getCurrentUser() {
  if (currentUser) return currentUser;
  const stored = localStorage.getItem('currentUser');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      return currentUser;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function clearCurrentUser() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  updateAuthUI();
}

/* ===== Auth API Calls ===== */
async function register(name, email, password) {
  try {
    const res = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');
    
    setToken(data.token);
    setCurrentUser(data.user);
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function login(email, password) {
  try {
    const res = await fetch(`${AUTH_API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');
    
    setToken(data.token);
    setCurrentUser(data.user);
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function logout() {
  removeToken();
  clearCurrentUser();
  closeAuthModal();
  showToast('Đã đăng xuất');
}

async function fetchProfile() {
  const token = getToken();
  if (!token) return null;
  
  try {
    const res = await fetch(`${AUTH_API}/profile`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      removeToken();
      clearCurrentUser();
      return null;
    }
    const data = await res.json();
    setCurrentUser(data.user);
    return data.user;
  } catch (err) {
    console.error('Fetch profile error:', err);
    return null;
  }
}

/* ===== Watch History ===== */
async function saveWatchHistory(movieSlug, movieName, moviePoster, episodeName, episodeIndex, serverIndex = 0) {
  const token = getToken();
  if (!token) return;
  
  try {
    const res = await fetch(`${AUTH_API}/history`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ movieSlug, movieName, moviePoster, episodeName, episodeIndex, serverIndex })
    });
    
    if (res.ok) {
      const data = await res.json();
      // Cập nhật local state
      if (currentUser) {
        currentUser.watchHistory = data.watchHistory;
        setCurrentUser(currentUser);
      }
    }
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

function getWatchHistory() {
  const user = getCurrentUser();
  return user?.watchHistory || [];
}

async function removeFromHistory(movieSlug) {
  const token = getToken();
  if (!token) return;
  
  try {
    const res = await fetch(`${AUTH_API}/history/${encodeURIComponent(movieSlug)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      const data = await res.json();
      if (currentUser) {
        currentUser.watchHistory = data.watchHistory;
        setCurrentUser(currentUser);
      }
      return data;
    }
  } catch (err) {
    console.error('Failed to remove from history:', err);
  }
}

async function clearAllHistory() {
  const token = getToken();
  if (!token) return;
  
  try {
    const res = await fetch(`${AUTH_API}/history`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      if (currentUser) {
        currentUser.watchHistory = [];
        setCurrentUser(currentUser);
      }
    }
  } catch (err) {
    console.error('Failed to clear history:', err);
  }
}

/* ===== UI Functions ===== */
function updateAuthUI() {
  const user = getCurrentUser();
  const authBtn = document.getElementById('authBtn');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  
  if (user) {
    if (authBtn) authBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (userName) userName.textContent = user.name;
  } else {
    if (authBtn) authBtn.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
  }
}

function showAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  switchAuthMode(mode);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
  clearAuthForm();
}

function switchAuthMode(mode) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  
  if (mode === 'login') {
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (loginTab) loginTab.classList.add('active');
    if (registerTab) registerTab.classList.remove('active');
  } else {
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (loginTab) loginTab.classList.remove('active');
    if (registerTab) registerTab.classList.add('active');
  }
  clearAuthError();
}

function clearAuthForm() {
  const inputs = document.querySelectorAll('#authModal input');
  inputs.forEach(input => input.value = '');
  clearAuthError();
}

function showAuthError(message) {
  const errorEl = document.getElementById('authError');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

function clearAuthError() {
  const errorEl = document.getElementById('authError');
  if (errorEl) errorEl.style.display = 'none';
}

function showToast(message, type = 'success') {
  // Xóa toast cũ nếu có
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ===== History Modal ===== */
function showHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderWatchHistory();
}

function closeHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function renderWatchHistory() {
  const container = document.getElementById('historyList');
  if (!container) return;
  
  const history = getWatchHistory();
  
  if (history.length === 0) {
    container.innerHTML = `
      <div class="no-history">
        <span>📺</span>
        <p>Chưa có lịch sử xem phim</p>
        <small>Các phim bạn đã xem sẽ xuất hiện ở đây</small>
      </div>`;
    return;
  }
  
  container.innerHTML = history.map(item => `
    <div class="history-item" data-slug="${item.movieSlug}">
      <img src="${item.moviePoster || 'https://via.placeholder.com/80x120?text=No+Image'}" 
           alt="${item.movieName}" 
           onerror="this.src='https://via.placeholder.com/80x120?text=No+Image'"
           loading="lazy">
      <div class="history-info">
        <h4>${item.movieName}</h4>
        <p class="episode-name">🎬 ${item.episodeName || 'Tập 1'}</p>
        <small>📅 ${formatDate(item.watchedAt)}</small>
      </div>
      <div class="history-actions">
        <button class="btn-continue" onclick="continueWatching('${item.movieSlug}', ${item.episodeIndex}, ${item.serverIndex || 0})">
          ▶ Tiếp tục
        </button>
        <button class="btn-remove" onclick="removeHistoryItem('${item.movieSlug}')" title="Xóa">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  
  return date.toLocaleDateString('vi-VN');
}

function continueWatching(slug, episodeIndex, serverIndex) {
  closeHistoryModal();
  location.href = `movie.html?slug=${encodeURIComponent(slug)}&ep=${episodeIndex}&server=${serverIndex}`;
}

async function removeHistoryItem(slug) {
  await removeFromHistory(slug);
  renderWatchHistory();
  showToast('Đã xóa khỏi lịch sử');
}

async function handleClearAllHistory() {
  if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử xem?')) return;
  await clearAllHistory();
  renderWatchHistory();
  showToast('Đã xóa toàn bộ lịch sử');
}

/* ===== Form Handlers ===== */
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  if (!email || !password) {
    showAuthError('Vui lòng nhập đầy đủ thông tin');
    return;
  }
  
  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang đăng nhập...';
  
  const result = await login(email, password);
  
  submitBtn.disabled = false;
  submitBtn.textContent = 'Đăng nhập';
  
  if (result.success) {
    closeAuthModal();
    showToast(`Chào mừng ${result.user.name}! 🎉`);
  } else {
    showAuthError(result.error);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  if (!name || !email || !password || !confirmPassword) {
    showAuthError('Vui lòng điền đầy đủ thông tin');
    return;
  }
  
  if (password !== confirmPassword) {
    showAuthError('Mật khẩu xác nhận không khớp');
    return;
  }
  
  if (password.length < 6) {
    showAuthError('Mật khẩu phải có ít nhất 6 ký tự');
    return;
  }
  
  // Disable button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang đăng ký...';
  
  const result = await register(name, email, password);
  
  submitBtn.disabled = false;
  submitBtn.textContent = 'Đăng ký';
  
  if (result.success) {
    closeAuthModal();
    showToast(`Đăng ký thành công! Chào mừng ${result.user.name}! 🎉`);
  } else {
    showAuthError(result.error);
  }
}

/* ===== Init Auth ===== */
function initAuth() {
  // Check existing session
  const token = getToken();
  if (token) {
    fetchProfile();
  }
  updateAuthUI();
  
  // Setup modal close on outside click
  const authModal = document.getElementById('authModal');
  const historyModal = document.getElementById('historyModal');
  
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }
  
  if (historyModal) {
    historyModal.addEventListener('click', (e) => {
      if (e.target === historyModal) closeHistoryModal();
    });
  }
  
  // Setup form submissions
  const loginFormEl = document.getElementById('loginFormElement');
  const registerFormEl = document.getElementById('registerFormElement');
  
  if (loginFormEl) loginFormEl.addEventListener('submit', handleLogin);
  if (registerFormEl) registerFormEl.addEventListener('submit', handleRegister);
  
  // Close modals on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeHistoryModal();
    }
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initAuth);

/* ===== Expose to global ===== */
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthMode = switchAuthMode;
window.logout = logout;
window.showHistoryModal = showHistoryModal;
window.closeHistoryModal = closeHistoryModal;
window.continueWatching = continueWatching;
window.removeHistoryItem = removeHistoryItem;
window.handleClearAllHistory = handleClearAllHistory;
window.saveWatchHistory = saveWatchHistory;
window.getCurrentUser = getCurrentUser;
window.getWatchHistory = getWatchHistory;
window.showToast = showToast;
window.togglePassword = togglePassword;
