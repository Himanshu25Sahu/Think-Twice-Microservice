import app from './app.js';
import connectDB from './database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5003;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`[ORG] ✓ Organization Service running on http://localhost:${PORT}`);
      console.log(`[ORG] ✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[ORG] ✗ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
