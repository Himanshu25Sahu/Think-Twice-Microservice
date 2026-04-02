import './telemetry.js';

import { app } from "./app.js";
import dotenv from 'dotenv'
import { connectDB } from "./database/connection.js";
dotenv.config();


const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔷 Decision Service running on port ${PORT}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Configuration:`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ LOADED (' + process.env.JWT_SECRET.substring(0, 10) + '...)' : '❌ UNDEFINED - TOKEN GENERATION WILL FAIL'}`);
    console.log(`   JWT_EXPIRES_IN: ${process.env.JWT_EXPIRES_IN || '⚠️  UNDEFINED (defaulting to 1h)'}`);
    console.log(`${'='.repeat(60)}`);
    try {
        console.log("📡 Connecting to MongoDB...");
        await connectDB();
        console.log("✅ MongoDB connected");
        console.log("✅ Decision Service ready\n");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }
})

