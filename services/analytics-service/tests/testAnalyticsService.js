import redis from 'redis';
import axios from 'axios';
import 'dotenv/config.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const API_BASE = 'http://localhost:5004';

const redisClient = redis.createClient({ url: REDIS_URL });

async function testAnalyticsService() {
  console.log('\n🧪 Analytics Service Test Suite\n');

  try {
    // Connect Redis for publishing events
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // Test 1: Health check
    console.log('\n📋 Test 1: Health Check');
    try {
      const health = await axios.get(`${API_BASE}/health`);
      console.log('✅ Health check passed:', health.data);
    } catch (err) {
      console.error('❌ Health check failed:', err.message);
    }

    // Test 2: Get org analytics (should return defaults for new org)
    console.log('\n📋 Test 2: Get Organization Analytics');
    try {
      const orgId = 'org-test-123';
      const orgAnalytics = await axios.get(`${API_BASE}/analytics/org/${orgId}`);
      console.log('✅ Org analytics (defaults):', orgAnalytics.data);
    } catch (err) {
      console.error('❌ Get org analytics failed:', err.message);
    }

    // Test 3: Get user analytics (should return defaults for new user)
    console.log('\n📋 Test 3: Get User Analytics');
    try {
      const userId = 'user-test-456';
      const orgId = 'org-test-123';
      const userAnalytics = await axios.get(`${API_BASE}/analytics/user/${userId}?orgId=${orgId}`);
      console.log('✅ User analytics (defaults):', userAnalytics.data);
    } catch (err) {
      console.error('❌ Get user analytics failed:', err.message);
    }

    // Test 4: Publish entry:created event
    console.log('\n📋 Test 4: Publish Entry Created Event');
    try {
      const eventData = JSON.stringify({
        eventType: 'entry:created',
        orgId: 'org-test-123',
        authorId: 'user-test-456',
        entryId: 'entry-123',
        type: 'architecture',
        timestamp: new Date().toISOString(),
      });

      await redisClient.xAdd('entry-events', '*', 'data', eventData);
      console.log('✅ Entry:created event published');
      
      // Wait for consumer to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Waiting for consumer to process...');
    } catch (err) {
      console.error('❌ Publish event failed:', err.message);
    }

    // Test 5: Get updated org analytics
    console.log('\n📋 Test 5: Check Updated Organization Analytics');
    try {
      const orgId = 'org-test-123';
      const orgAnalytics = await axios.get(`${API_BASE}/analytics/org/${orgId}`);
      const data = orgAnalytics.data.data;
      
      if (data.totalEntries === 1 && data.entriesByType.architecture === 1) {
        console.log('✅ Org metrics updated correctly:', data);
      } else {
        console.log('⚠️  Org metrics not updated as expected:', data);
      }
    } catch (err) {
      console.error('❌ Get updated org analytics failed:', err.message);
    }

    // Test 6: Get overview
    console.log('\n📋 Test 6: Get Overview Dashboard');
    try {
      const userId = 'user-test-456';
      const orgId = 'org-test-123';
      const overview = await axios.get(
        `${API_BASE}/analytics/overview?orgId=${orgId}`,
        {
          headers: { 'x-user-id': userId }
        }
      );
      console.log('✅ Overview dashboard:', overview.data);
    } catch (err) {
      console.error('❌ Get overview failed:', err.message);
    }

    // Test 7: Multiple entries in different types
    console.log('\n📋 Test 7: Publish Multiple Events');
    try {
      for (let i = 0; i < 3; i++) {
        const eventData = JSON.stringify({
          eventType: 'entry:created',
          orgId: 'org-test-123',
          authorId: 'user-test-456',
          entryId: `entry-${i}`,
          type: i % 2 === 0 ? 'debugging' : 'feature',
          timestamp: new Date().toISOString(),
        });

        await redisClient.xAdd('entry-events', '*', 'data', eventData);
      }
      console.log('✅ Published 3 more events');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Waiting for consumer to process...');
    } catch (err) {
      console.error('❌ Publish multiple events failed:', err.message);
    }

    // Test 8: Check final metrics
    console.log('\n📋 Test 8: Check Final Metrics');
    try {
      const orgId = 'org-test-123';
      const orgAnalytics = await axios.get(`${API_BASE}/analytics/org/${orgId}`);
      const data = orgAnalytics.data.data;
      
      console.log('✅ Final org metrics:');
      console.log(`   - Total entries: ${data.totalEntries}`);
      console.log(`   - By type: ${JSON.stringify(data.entriesByType)}`);
      console.log(`   - Top contributors: ${JSON.stringify(data.topContributors)}`);
    } catch (err) {
      console.error('❌ Check final metrics failed:', err.message);
    }

    console.log('\n✅ All tests completed!\n');
  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  } finally {
    await redisClient.disconnect();
    console.log('🔌 Disconnected from Redis\n');
  }
}

// Run tests
testAnalyticsService();
