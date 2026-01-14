const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const watchHistorySchema = new mongoose.Schema({
  movieSlug: { type: String, required: true },
  movieName: { type: String, required: true },
  moviePoster: { type: String, default: '' },
  episodeName: { type: String, default: '' },
  episodeIndex: { type: Number, default: 0 },
  serverIndex: { type: Number, default: 0 },
  watchedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vui lòng nhập tên'],
    trim: true,
    minlength: [2, 'Tên phải có ít nhất 2 ký tự'],
    maxlength: [50, 'Tên không được quá 50 ký tự']
  },
  email: {
    type: String,
    required: [true, 'Vui lòng nhập email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email không hợp lệ']
  },
  password: {
    type: String,
    required: [true, 'Vui lòng nhập mật khẩu'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
    select: false // Không trả về password khi query
  },
  avatar: {
    type: String,
    default: ''
  },
  watchHistory: {
    type: [watchHistorySchema],
    default: []
  },
  favorites: [{
    type: String // Movie slugs
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index cho tìm kiếm nhanh
userSchema.index({ email: 1 });
userSchema.index({ 'watchHistory.movieSlug': 1 });

// Hash password trước khi save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method so sánh password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method để ẩn thông tin nhạy cảm khi trả về JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
