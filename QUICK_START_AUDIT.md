# QUICK START: Phase 1 JWT Fix + Full Audit

## 🚀 IMMEDIATE ACTIONS (5 MIN)

### Step 1: Clean Rebuild
```bash
cd d:\think-twice-latest
docker-compose down
docker system prune -a --volumes
docker-compose build --no-cache
docker-compose up
```

**Watch for these 3 messages in the logs:**
```
✅ JWT_SECRET: ✅ LOADED (wuqppqpsa...)    [API Gateway]
✅ JWT_SECRET: ✅ LOADED (wuqppqpsa...)    [Decision Service]
✅ Analytics Service ready
```

If you see `❌ UNDEFINED`, STOP and check `.env.docker` and `docker-compose.yml`.

---

## 🧪 WHAT TO TEST IN YOUR APP (10-15 MIN)

### Frontend Tests (Browser at http://localhost:3000)

**Test 1: Login Works (Was Failing With 401)**
1. Click "Login"
2. Enter test credentials
3. ✅ Should see dashboard (NOT 401 error)
4. Open F12 → Network tab
5. Look for any RED requests (401/403)
   - Should be ZERO red requests
   - All green (200/201)

**Test 2: Create a Decision**
1. Go to Dashboard
2. Click "Create Decision"
3. Fill out the form
4. Submit
5. ✅ Should succeed and appear in the list

**Test 3: View Analytics**
1. Check if confidence/category stats appear
2. They should update as you create more decisions

### API Tests (Terminal)

**Test 4: Direct API Login**
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected: 200 (not 401)

**Test 5: Protected Route Access**  
```bash
curl -X GET http://localhost:5000/decisions/my \
  -b /tmp/cookies.txt
```

Expected: 200 with decisions array (not 401 "invalid signature")

**Test 6: Event-Driven Architecture**
```bash
# Check if events are being processed
docker logs tt-analytics-service | grep "Event processed"
```

Expected: See event processing logs

---

## 📊 VERIFICATION CHECKLIST

Once services start, verify these appear in logs:

- [ ] API Gateway: `JWT_SECRET: ✅ LOADED`
- [ ] Decision Service: `JWT_SECRET: ✅ LOADED`
- [ ] Analytics Service: All event listeners started
- [ ] MongoDB: Connected to all services
- [ ] Redis: Connected successfully
- [ ] Client: Ready at localhost:3000

---

## ✅ READY FOR PHASE 3 WHEN:

- [ ] You can login without 401 errors
- [ ] Protected routes return data (200 status)
- [ ] Can create decisions successfully
- [ ] Browser Network tab shows NO 401/403 errors
- [ ] All 3 services show JWT_SECRET loaded ✅

Once all above are checked, you're ready for Phase 3 (Distributed Tracing).

---

## 🆘 IF STILL GETTING 401 "INVALID SIGNATURE"

1. **Check logs** specifically for:
   ```
   [GATEWAY] ❌ Auth error: invalid signature
   ```

2. **Verify JWT_SECRET**:
   ```bash
   grep JWT_SECRET d:\think-twice-latest\.env.docker
   # Should show: JWT_SECRET=wuqppqpsancesfjgsdfsldfs
   
   grep -n "JWT_SECRET" d:\think-twice-latest\docker-compose.yml
   # Should show it in api-gateway, decision-service, analytics-service environment
   ```

3. **Force complete reset**:
   ```bash
   docker-compose down -v  # Remove volumes too
   docker image rm $(docker image ls -q)  # Remove all images
   docker-compose up --build
   ```

4. **Check if token is being set in cookie**:
   - Login via browser
   - Open F12 → Application → Cookies
   - Should see `token` cookie with a long JWT value
   - If missing, token generation failed

---

## 📈 WHAT CHANGED

| What | Before (Failing) | After (Fixed) |
|------|------------------|---------------|
| JWT Secret | Possible mismatch between services | Explicitly set same value in all |
| Logging | No visibility into secret loading | Clear logs showing ✅ LOADED |
| Auth Errors | Generic "invalid signature" | Detailed error logs explain root cause |
| Docker Compose | Relied only on env_file | Explicit environment variables |

---

## 🎯 SUCCESS CRITERIA

You successfully fixed Phase 1 when:

```
✅ POST /auth/login → 200 (success)
✅ GET /decisions/my → 200 (returns data, not 401)
✅ POST /decisions/create → 201 (creates decision)
✅ All browser network requests are green
✅ No 401 "invalid signature" errors anywhere
```

Once these are verified, **Phase 1 is complete** and you can move to Phase 3.
