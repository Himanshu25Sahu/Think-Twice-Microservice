import express from 'express';
import * as entryController from '../controllers/entryController.js';
import orgAccess from '../middleware/orgAccess.js';

const router = express.Router();

router.get('/', orgAccess, entryController.getEntries);
router.post('/', orgAccess, entryController.createEntry);
router.get('/:id', orgAccess, entryController.getEntry);
router.put('/:id', orgAccess, entryController.updateEntry);
router.delete('/:id', orgAccess, entryController.deleteEntry);
router.post('/:id/upvote', orgAccess, entryController.toggleUpvote);

export default router;
