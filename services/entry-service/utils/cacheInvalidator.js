/**
 * Cache invalidation utilities (optional event-driven approach)
 * Note: Current system uses inline invalidateCache calls in controller
 * This module provides optional async monitoring via Redis Streams consumer
 * (Not blocking - controller invalidation happens synchronously)
 */

import { redisClient } from './redisClient.js';

/**
 * Optional: Start monitoring Redis Streams for cache invalidation events
 * This is NON-BLOCKING and runs in background (separate from main request handling)
 * Actual invalidation happens inline in entryController functions
 */
export const initCacheInvalidation = async () => {
  // Optional: Could implement Redis Stream consumer here
  // For now, inline invalidation in controller is sufficient
  console.log('[ENTRY] ✓ Cache invalidation system ready (inline + SCAN-based)');
};

