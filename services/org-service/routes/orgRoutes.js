import express from 'express';
import * as orgController from '../controllers/orgController.js';

const router = express.Router();

router.post('/create', orgController.createOrganization);
router.post('/join', orgController.joinOrganization);
router.get('/my-orgs', orgController.getMyOrganizations);
router.get('/:orgId', orgController.getOrganization);
router.put('/switch/:orgId', orgController.switchOrganization);
router.put('/:orgId/members/role', orgController.updateMemberRole);
router.delete('/:orgId/members', orgController.removeMember);

export default router;
