import express from 'express';
import * as orgController from '../controllers/orgController.js';

const router = express.Router();

router.post('/create', orgController.createOrganization);
router.post('/join', orgController.joinOrganization);
router.get('/my-orgs', orgController.getMyOrganizations);
router.post('/:orgId/projects', orgController.createProject);
router.get('/:orgId/projects', orgController.listProjects);
router.get('/:orgId/members/search', orgController.searchOrganizationMembers);
router.get('/:orgId', orgController.getOrganization);
router.put('/switch/:orgId', orgController.switchOrganization);
router.put('/switch-project/:projectId', orgController.switchProject);
router.put('/:orgId/members/role', orgController.updateMemberRole);
router.delete('/:orgId/members', orgController.removeMember);

export default router;
