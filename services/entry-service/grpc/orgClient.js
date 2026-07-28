import path from 'path';
import { fileURLToPath } from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'org.proto');

const USE_GRPC = String(process.env.USE_GRPC).toLowerCase() === 'true';
const ORG_REST_URL = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
const ORG_GRPC_URL = process.env.ORG_GRPC_URL || 'localhost:50052';
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
    const orgProto = grpc.loadPackageDefinition(packageDefinition).org;
    cachedClient = new orgProto.OrgService(ORG_GRPC_URL, grpc.credentials.createInsecure());
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

// Build an axios-like HTTP error so orgAccess's existing status checks
// (err.response?.status === 403, etc.) work unchanged over gRPC.
const httpLikeError = (status, message) => {
  const error = new Error(message);
  error.response = { status };
  return error;
};

// Returns the same shape as `axios.get(.../org/:orgId)` => response.data.data === org.
export const getOrganization = async ({ orgId, userId, traceId }) => {
  if (!USE_GRPC) {
    return axios.get(`${ORG_REST_URL}/org/${orgId}`, {
      headers: { 'x-trace-id': traceId, 'x-user-id': userId },
      timeout: 5000,
    });
  }

  const response = await unaryCall('getOrganization', { orgId, userId, traceId });
  if (!response.found) {
    throw httpLikeError(404, 'Organization not found');
  }

  const org = response.organization;
  return {
    data: {
      success: true,
      data: {
        _id: org.id,
        name: org.name,
        owner: org.owner,
        members: (org.members || []).map((member) => ({
          userId: member.userId,
          role: member.role,
        })),
      },
    },
  };
};

// Returns the same shape as `axios.get(.../org/:orgId/projects)` => response.data.data === projects[].
export const listProjects = async ({ orgId, userId, traceId }) => {
  if (!USE_GRPC) {
    return axios.get(`${ORG_REST_URL}/org/${orgId}/projects`, {
      headers: { 'x-trace-id': traceId, 'x-user-id': userId },
    });
  }

  const response = await unaryCall('listProjects', { orgId, userId, traceId });
  if (!response.found) {
    throw httpLikeError(404, 'Organization not found');
  }
  if (response.accessDenied) {
    throw httpLikeError(403, 'Access denied');
  }

  const projects = (response.projects || []).map((project) => ({
    _id: project.id,
    name: project.name,
    orgId: project.orgId,
  }));

  return { data: { success: true, data: projects } };
};

export default { getOrganization, listProjects };
