// routes/decisionRoutes.js
import express from 'express';
import { isAuthenticated } from '../utils/isAuthenticated.js';
import {
  createDecision,
  updateDecision,
  getDecision,
  getUserDecisions,
  getPublicDecisions,
  deleteDecision,
  toggleLike,
  addComment,
  deleteComment,
  getDecisionsForReview,
  getDecisionAnalytics,
  enablePoll,
  votePoll,
  getMyDecisions
} from '../controllers/decisionController.js';

export const decisionRouter = express.Router();

decisionRouter.use(isAuthenticated);

decisionRouter.post('/', createDecision); 
decisionRouter.get('/public', getPublicDecisions);
decisionRouter.get('/review', getDecisionsForReview);
decisionRouter.get('/my',getMyDecisions)
decisionRouter.get('/analytics/:userId', getDecisionAnalytics);
decisionRouter.get('/user/:userId', getUserDecisions);
decisionRouter.get('/:id', getDecision);
decisionRouter.post('/:id', updateDecision);
decisionRouter.delete('/:id', deleteDecision);
decisionRouter.post('/:id/like', toggleLike);
decisionRouter.post('/:id/comment', addComment);
decisionRouter.delete('/:id/comment/:commentId', deleteComment);

decisionRouter.put('/:id/poll/enable', enablePoll);
decisionRouter.post('/:id/poll/vote', votePoll);

// Add endpoint to record decision outcome
decisionRouter.post('/decisions/:id/review', async (req, res) => {
  const { actualOutcome, successRating, reflection } = req.body;
  try {
    const decision = await DecisionModel.findById(req.params.id);
    if (!decision) return res.status(404).json({ error: 'Decision not found' });
    decision.isReviewed = true;
    decision.actualOutcome = actualOutcome;
    decision.successRating = successRating;
    if (reflection) decision.reflection = reflection;
    await decision.save();
    res.json({ success: true, decision });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add poll endpoint for decisions
decisionRouter.post('/decisions/:id/poll', async (req, res) => {
  const { option } = req.body;
  try {
    const decision = await DecisionModel.findById(req.params.id);
    if (!decision) return res.status(404).json({ error: 'Decision not found' });
    // Initialize pollResults if missing
    if (!decision.pollResults) decision.pollResults = {};
    decision.pollResults[option] = (decision.pollResults[option] || 0) + 1;
    await decision.save();
    res.json({ success: true, results: decision.pollResults });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
