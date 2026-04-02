import app from './app.js';
import connectDB from './database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 AUTH SERVICE - STARTING');
    console.log('='.repeat(60));
    console.log('⏳ Connecting to MongoDB...');
    
    // Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB Connected');

    // Start server
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('✅ AUTH SERVICE READY');
      console.log('='.repeat(60));
      console.log(`📍 Running on: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 JWT_SECRET: ${process.env.JWT_SECRET ? '✅ LOADED' : '❌ MISSING'}`);
      console.log(`📊 MongoDB URL: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/think-twice'}`);
      console.log('='.repeat(60));
      console.log('🎯 Ready to receive requests...\n');
    });

    // Log for any connection errors
    server.on('error', (err) => {
      console.error('[AUTH] ❌ Server error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`[AUTH] ❌ Port ${PORT} is already in use!`);
      }
    });
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ FAILED TO START AUTH SERVICE');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
};

startServer();
