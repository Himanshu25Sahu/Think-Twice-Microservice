import express from 'express'
export const analyticsRoutes=express.Router();
import { isAuthenticated } from '../utils/isAuthenticated.js';
import { getAnalytics } from '../controllers/getAnalytics.js';

analyticsRoutes.get('/get-analytics',isAuthenticated,getAnalytics);

// Add endpoint for expanded analytics metrics
analyticsRoutes.get('/analytics/trends', async (req, res) => {
  const { range = 'month' } = req.query;
  try {
    const stats = await calculateTrends(range);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRoutes.get('/analytics/category/:category/stats', async (req, res) => {
  try {
    const stats = await calculateCategoryStats(req.params.category);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRoutes.get('/analytics/predictions', async (req, res) => {
  try {
    const predictions = await calculateConfidenceBreakdown();
    res.json(predictions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Advanced analytics endpoint (calls Python microservice)
analyticsRoutes.get('/analytics/advanced', async (req, res) => {
  const { userId, range = 'month' } = req.query;
  try {
    // Example: Call Python microservice via HTTP
    const response = await fetch(`http://localhost:5000/analytics?userId=${userId}&range=${range}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

