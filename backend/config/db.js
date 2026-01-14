const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // MongoDB connection string
    // Local: mongodb://localhost:27017/lamviet-movie
    // Atlas: mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/lamviet-movie
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lamviet-movie';
    
    const conn = await mongoose.connect(mongoURI, {
      // Mongoose 6+ không cần các options này nữa, nhưng để đây cho tương thích
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Xử lý sự kiện connection
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    // Không exit ngay, để app có thể chạy mà không có DB (cho development)
    console.log('⚠️ App sẽ chạy nhưng tính năng user sẽ không hoạt động');
    return null;
  }
};

module.exports = connectDB;
