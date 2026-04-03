import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Log all auth route requests
router.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || 'no-trace';
  console.log(`🔐 [AUTH-ROUTES] Matched route: ${req.method} ${req.path} trace=${traceId}`);
  next();
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/update-active-org', authController.updateActiveOrg);
router.put('/add-org', authController.addOrganization);
router.put('/remove-org', authController.removeOrganization);

export default router;
