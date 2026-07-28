import path from 'path';
import { fileURLToPath } from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import axios from 'axios';
import { withRetry } from '../utils/retry.js';
import { buildForwardHeaders } from '../../shared/traceHeaders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'auth.proto');

const USE_GRPC = String(process.env.USE_GRPC).toLowerCase() === 'true';
const AUTH_REST_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const AUTH_GRPC_URL = process.env.AUTH_GRPC_URL || 'localhost:50051';
const GRPC_DEADLINE_MS = 5000;

let cachedClient = null;

const getClient = () => {
  if (!cachedClient) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const authProto = grpc.loadPackageDefinition(packageDefinition).auth;
    cachedClient = new authProto.AuthService(AUTH_GRPC_URL, grpc.credentials.createInsecure());
  }
  return cachedClient;
};

const unaryCall = (method, payload) =>
  new Promise((resolve, reject) => {
    const client = getClient();
    const deadline = new Date(Date.now() + GRPC_DEADLINE_MS);
    client[method](payload, new grpc.Metadata(), { deadline }, (error, response) => {
      if (error) return reject(error);
      resolve(response);
    });
  });

const traceOf = (req) => req?.headers?.['x-trace-id'] || 'grpc';

// Each method returns an axios-like shape ({ data: ... }) on success and throws
// on failure, so the controller's existing try/catch handling is unchanged
// regardless of whether the gRPC or REST transport is active.

export const getUser = async (req, { userId }) => {
  if (USE_GRPC) {
    const response = await unaryCall('getUser', { userId, traceId: traceOf(req) });
    return { data: { data: { user: response.found ? response.user : null } } };
  }
  return withRetry(() =>
    axios.get(`${AUTH_REST_URL}/auth/me`, {
      headers: buildForwardHeaders(req, { 'x-user-id': userId }),
      timeout: 5000,
    })
  );
};

export const addOrg = async (req, { userId, orgId }) => {
  if (USE_GRPC) {
    return unaryCall('addOrganization', { userId, orgId, traceId: traceOf(req) });
  }
  return withRetry(() =>
    axios.put(
      `${AUTH_REST_URL}/auth/add-org`,
      { userId, orgId },
      { headers: buildForwardHeaders(req, { 'Content-Type': 'application/json' }), timeout: 5000 }
    )
  );
};

export const removeOrg = async (req, { userId, orgId }) => {
  if (USE_GRPC) {
    return unaryCall('removeOrganization', { userId, orgId, traceId: traceOf(req) });
  }
  return withRetry(() =>
    axios.put(
      `${AUTH_REST_URL}/auth/remove-org`,
      { userId, orgId },
      { headers: buildForwardHeaders(req, { 'Content-Type': 'application/json' }), timeout: 5000 }
    )
  );
};

export const updateActiveOrg = async (req, { userId, orgId }) => {
  if (USE_GRPC) {
    return unaryCall('updateActiveOrg', { userId, orgId, traceId: traceOf(req) });
  }
  return withRetry(() =>
    axios.put(
      `${AUTH_REST_URL}/auth/update-active-org`,
      { orgId },
      { headers: buildForwardHeaders(req, { 'x-user-id': userId, 'Content-Type': 'application/json' }), timeout: 5000 }
    )
  );
};

export const updateActiveProject = async (req, { userId, projectId }) => {
  if (USE_GRPC) {
    return unaryCall('updateActiveProject', { userId, projectId, traceId: traceOf(req) });
  }
  return withRetry(() =>
    axios.put(
      `${AUTH_REST_URL}/auth/update-active-project`,
      { projectId },
      { headers: buildForwardHeaders(req, { 'x-user-id': userId, 'Content-Type': 'application/json' }), timeout: 5000 }
    )
  );
};

export default { getUser, addOrg, removeOrg, updateActiveOrg, updateActiveProject };
