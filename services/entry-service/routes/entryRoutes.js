import express from 'express';
import * as entryController from '../controllers/entryController.js';
import orgAccess, { requireRole } from '../middleware/orgAccess.js';
import upload from '../utils/upload.js';

const router = express.Router();

// Read operations (all authenticated members can read)
router.get('/', orgAccess, entryController.getEntries);
router.get('/graph', orgAccess, entryController.getGraph);
router.get('/:id', orgAccess, entryController.getEntry);

// Write operations (members and above can create)
router.post(
	'/',
	orgAccess,
	requireRole('owner', 'admin', 'member'),
	upload.fields([
		{ name: 'image', maxCount: 1 },
		{ name: 'images', maxCount: 3 },
		{ name: 'images[]', maxCount: 3 },
	]),
	entryController.createEntry
);

// Update and delete operations (admin and owner can always update/delete; members can delete their own)
router.put('/:id', orgAccess, requireRole('owner', 'admin'), entryController.updateEntry);
router.delete('/:id', orgAccess, requireRole('owner', 'admin', 'member'), entryController.deleteEntry);

// Vote operations (all authenticated members can vote)
router.post('/:id/upvote', orgAccess, entryController.toggleUpvote);
router.post('/:id/downvote', orgAccess, entryController.toggleDownvote);

// Relations operations (members and above can manage relations)
router.post('/:id/relations', orgAccess, requireRole('owner', 'admin', 'member'), entryController.addRelation);
router.delete('/:id/relations/:targetId', orgAccess, requireRole('owner', 'admin', 'member'), entryController.removeRelation);

export default router;
