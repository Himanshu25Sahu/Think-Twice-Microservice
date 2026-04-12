# Production Deployment Checklist

## Pre-Deployment Verification ✅

### Backend (entry-service)
- [x] `redisClient.js` - SCAN-based invalidation implemented
- [x] `cacheInvalidator.js` - Event-driven listeners created
- [x] `app.js` - Cache invalidator initialized on startup
- [x] `entryController.js` - `getPaginatedEntries` helper exported
- [x] `entryController.js` - `getGraph` endpoint now caches (60s TTL)
- [x] No syntax errors detected
- [x] All existing endpoints unchanged (backward compatible)

### Tracing (gateway + services)
- [x] Jaeger service added to `docker-compose.yml`
- [x] Gateway telemetry bootstrap added (`gateway/telemetry.js`)
- [x] Analytics telemetry bootstrap imported in startup path
- [x] Shared trace header propagation helper created (`services/shared/traceHeaders.js`)
- [x] W3C trace headers forwarded across gateway proxy routes
- [x] Inter-service axios calls updated to forward trace context
- [x] Unit tests added for shared trace header helper

### Frontend (client)
- [x] Redux `entrySlice.js` - Added `resetCache` action
- [x] Redux `entrySlice.js` - Added pagination state (`hasMore`, `cacheInvalidated`)
- [x] Redux `entrySlice.js` - Infinite scroll state logic implemented
- [x] Dashboard page - Infinite scroll with IntersectionObserver
- [x] Dashboard page - Debounced search (300ms)
- [x] Dashboard page - Loading states (first page skeletons, paging dots)
- [x] Dashboard page - "No more entries" indicator
- [x] Dashboard page - Filter reset on type change
- [x] No syntax errors detected

---

## Integration Testing

### Tracing Validation Flow
```
Test T1: Jaeger Availability
- Start stack with docker compose
- Verify Jaeger UI at http://localhost:16686
- Verify API returns service list at /api/services
```

```
Test T2: Gateway Trace Header Echo
- Call /api/health with custom x-trace-id and traceparent
- Expected: response includes same x-trace-id header
```

```
Test T3: Cross-Service Trace Chain
- Trigger /entries and /org endpoints through gateway
- Expected: Jaeger shows spans including gateway + downstream service
- Expected: logs include same x-trace-id for correlated events
```

```
Test T4: Automated Smoke
- Run: ./scripts/verify-tracing.sh
- Expected: Jaeger reachable, gateway trace headers work, service names visible
```

### Cache Invalidation Flow
```
Test 1: Create Entry
- Expected: Cache cleared for `entries:${orgId}:${projectId}:*`
- Verify: Dashboard shows new entry on page 1 after creating
- Logs: Should see "[ENTRY] Cache invalidated on entry:created"
```

```
Test 2: Update Entry  
- Expected: Cache cleared for `entries:${orgId}:${projectId}:*`
- Verify: Updated entry reflects on dashboard immediately
- Logs: Should see "[ENTRY] Cache invalidated on entry:updated"
```

```
Test 3: Filter Change
- Expected: Reset to page 1, entries cleared
- Verify: Dashboard fetches fresh with new filter
- Redux: `cacheInvalidated = true` → `page = 1`
```

### Infinite Scroll Testing
```
Test 4: Scroll to Bottom
- Load page 1 (12 entries)
- Scroll to bottom
- IntersectionObserver triggers
- Page 2 fetches and appends
- Total entries: 24
- No duplicates
```

```
Test 5: Last Page Indicator
- Scroll until `hasMore = false`
- Should show "No more entries"
- Scroll sentinel should not trigger fetch
```

### Search/Debounce Testing
```
Test 6: Debounced Search
- Type search query
- Wait 300ms
- Should only trigger ONE fetch
- Reset to page 1 automatically
```

---

## Performance Monitoring

### Redis Metrics to Watch
```bash
# Monitor cache patterns
redis-cli SCAN 0 MATCH "entries:*" COUNT 100
redis-cli SCAN 0 MATCH "graph:*" COUNT 100

# Check TTL on keys
redis-cli TTL "entries:org1:project1:<hash>"  # Should be ~300
redis-cli TTL "graph:org1:project1"            # Should be ~60
```

### Application Logs
```
Look for patterns:
- "[ENTRY] Cache hit: entries:..." (good - reading from cache)
- "[ENTRY] Cache invalidated on entry:created" (expected on mutations)
- "[ENTRY] Invalidated 0 cache keys" (OK - no old patterns)
- "[ENTRY] Graph cache hit: graph:..." (good - graph cached)
```

### Frontend Performance
```
Chrome DevTools → Performance
- Monitor: Network requests per scroll
- Expected: 1 request per page
- Memory: Should not grow indefinitely
- Each page: ~12 entries appended
```

---

## Rollback Plan

If issues arise:

1. **Cache Issues (Redis):**
   ```bash
   # Clear all entry caches
   redis-cli FLUSHALL
   # Or specific pattern
   redis-cli UNLINK $(redis-cli KEYS "entries:*")
   ```

2. **Old Code Deployment:**
   ```bash
   git revert <commit-hash>
   npm run build
   npm start  # Backend restart clears cache invalidator
   ```

3. **Redux State Reset:**
   - Clear browser localStorage
   - Hard refresh (Ctrl+Shift+R)
   - Redux state resets to initial

---

## Success Criteria

✅ Implementation is complete when:

1. **Backend:**
   - [ ] All 4 files modified without errors
   - [ ] Entry service starts without warnings
   - [ ] Cache invalidator initializes on startup
   - [ ] Redis SCAN doesn't block with large key sets
   - [ ] getGraph caches successfully (60s)

2. **Frontend:**
   - [ ] Redux slice handles all entry mutations
   - [ ] Dashboard implements infinite scroll
   - [ ] Filter changes reset pagination
   - [ ] Search debounces correctly
   - [ ] Loading states show appropriately

3. **Integration:**
   - [ ] Create → cache cleared → fresh page 1 loaded
   - [ ] Filter change → reset to page 1
   - [ ] Scroll to bottom → page 2 appends
   - [ ] Last page → "No more entries" shows
   - [ ] Upvote/downvote → instant update

4. **Performance:**
   - [ ] Cache hit ratio > 50% (normal usage)
   - [ ] Graph endpoint < 200ms with cache
   - [ ] Infinite scroll memory stable
   - [ ] No duplicates in appended entries

---

## Post-Deployment Tasks

- [ ] Monitor error rate (target: < 1%)
- [ ] Track cache hit/miss ratio
- [ ] Verify Redis memory usage
- [ ] Confirm infinite scroll UX works
- [ ] Check search debounce effectiveness
- [ ] Review application logs for warnings
- [ ] Get user feedback on new UX
- [ ] Document any customizations needed

---

## Maintenance Notes

### Cache Key Naming
- **Entries List:** `entries:${orgId}:${projectId}:${queryHash}`
  - TTL: 300 seconds (5 min)
  - Pattern: Regenerated on each unique filter/page/sort combo

- **Graph:** `graph:${orgId}:${projectId}`
  - TTL: 60 seconds (1 min)
  - Pattern: One per org/project

### Event Listeners
All in `cacheInvalidator.js`:
- `entry:created` → Invalidate entries list
- `entry:updated` → Invalidate entries list
- `entry:deleted` → Invalidate entries list
- `entry:mentioned` → Invalidate entries list
- `entry:relation:changed` → Invalidate graph only

### Future Enhancements
- [ ] Implement Redis Streams for event persistence
- [ ] Add WebSocket real-time updates
- [ ] Cache individual entry details
- [ ] Implement user-specific cache (mentions)
- [ ] Add cache statistics API endpoint

---

Generated: April 7, 2026
Author: Production Engineering Team
