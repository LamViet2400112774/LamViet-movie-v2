const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'lamviet-movie-secret-key-2026';
const JWT_EXPIRES = '7d';

/* ===== Middleware xác thực ===== */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Không có token xác thực' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không tồn tại' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token đã hết hạn' });
    }
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

/* ===== Tạo JWT Token ===== */
function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/* ===== ĐĂNG KÝ ===== */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    // Tạo user mới
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    await user.save();

    // Tạo token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        watchHistory: user.watchHistory
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    
    // Xử lý lỗi validation của Mongoose
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: messages[0] });
    }
    
    // Xử lý lỗi duplicate key
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

/* ===== ĐĂNG NHẬP ===== */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }

    // Tìm user và lấy cả password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // So sánh password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // Cập nhật last login
    user.lastLogin = new Date();
    await user.save();

    // Tạo token
    const token = generateToken(user._id);

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        watchHistory: user.watchHistory
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

/* ===== LẤY THÔNG TIN PROFILE ===== */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        watchHistory: req.user.watchHistory,
        createdAt: req.user.createdAt
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/* ===== CẬP NHẬT PROFILE ===== */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    
    if (name) req.user.name = name.trim();
    if (avatar !== undefined) req.user.avatar = avatar;
    
    await req.user.save();

    res.json({
      message: 'Cập nhật thành công',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/* ===== ĐỔI MẬT KHẨU ===== */
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    // Lấy user với password
    const user = await User.findById(req.user._id).select('+password');
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/* ===== LƯU LỊCH SỬ XEM ===== */
router.post('/history', authMiddleware, async (req, res) => {
  try {
    const { movieSlug, movieName, moviePoster, episodeName, episodeIndex, serverIndex } = req.body;

    if (!movieSlug || !movieName) {
      return res.status(400).json({ error: 'Thiếu thông tin phim' });
    }

    const historyItem = {
      movieSlug,
      movieName,
      moviePoster: moviePoster || '',
      episodeName: episodeName || '',
      episodeIndex: episodeIndex || 0,
      serverIndex: serverIndex || 0,
      watchedAt: new Date()
    };

    // Tìm và cập nhật hoặc thêm mới
    const existingIndex = req.user.watchHistory.findIndex(h => h.movieSlug === movieSlug);

    if (existingIndex >= 0) {
      req.user.watchHistory[existingIndex] = historyItem;
    } else {
      req.user.watchHistory.unshift(historyItem);
    }

    // Giữ tối đa 50 phim trong lịch sử
    if (req.user.watchHistory.length > 50) {
      req.user.watchHistory = req.user.watchHistory.slice(0, 50);
    }

    await req.user.save();

    res.json({
      message: 'Đã lưu lịch sử',
      watchHistory: req.user.watchHistory
    });
  } catch (err) {
    console.error('Save history error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/* ===== LẤY LỊCH SỬ XEM ===== */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    res.json({ watchHistory: req.user.watchHistory });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/* ===== XÓA 1 PHIM KHỎI LỊCH SỬ ===== */
router.delete('/history/:movieSlug', authMiddleware, async (req, res) => {
  try {
    const { movieSlug } = req.params;
    
    req.user.watchHistory = req.user.watchHistory.filter(h => h.movieSlug !== movieSlug);
    await req.user.save();

    res.json({
      message: 'Đã xóa khỏi lịch sử',
      watchHistory: req.user.watchHistory
    });
  } catch (err) {
    console.error('Delete history item error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/* ===== XÓA TOÀN BỘ LỊCH SỬ ===== */
router.delete('/history', authMiddleware, async (req, res) => {
  try {
    req.user.watchHistory = [];
    await req.user.save();

    res.json({ message: 'Đã xóa toàn bộ lịch sử' });
  } catch (err) {
    console.error('Clear history error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
