import { v4 as uuidv4 } from 'uuid';

export const traceId = (req, res, next) => {
  const trace = req.headers['x-trace-id'] || uuidv4();
  req.traceId = trace;
  res.setHeader('x-trace-id', trace);
  
  console.log(`[GATEWAY] ${req.method} ${req.url} trace=${trace}`);
  
  next();
};

export default traceId;
