import path from 'path';
import { fileURLToPath } from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import Organization from '../models/Organization.js';
import Project from '../models/Project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'org.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const orgProto = grpc.loadPackageDefinition(packageDefinition).org;

const getMemberRole = (org, userId) => {
  if (!org || !userId) return null;
  if (org.owner === userId) return 'owner';
  return org.members.find((member) => member.userId === userId)?.role || null;
};

// Data-fetch equivalent of GET /org/:orgId (without the auth-service member
// enrichment that entry-service does not need). Membership is enforced
// caller-side by resolving the user's role from the returned members list,
// matching the existing REST behaviour in entry orgAccess.
const getOrganization = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  try {
    const org = await Organization.findById(call.request.orgId);
    if (!org) {
      return callback(null, { found: false, organization: null });
    }

    return callback(null, {
      found: true,
      organization: {
        id: org._id.toString(),
        name: org.name || '',
        owner: org.owner || '',
        members: org.members.map((member) => ({
          userId: member.userId,
          role: member.role,
        })),
      },
    });
  } catch (error) {
    console.error(`[ORG-GRPC] GetOrganization error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

// Mirrors orgController.listProjects.
const listProjects = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  try {
    const org = await Organization.findById(call.request.orgId);
    if (!org) {
      return callback(null, { found: false, accessDenied: false, projects: [] });
    }

    const role = getMemberRole(org, call.request.userId);
    if (!role) {
      return callback(null, { found: true, accessDenied: true, projects: [] });
    }

    const projects = await Project.find({ orgId: call.request.orgId.toString() }).sort({ createdAt: 1 });

    return callback(null, {
      found: true,
      accessDenied: false,
      projects: projects.map((project) => ({
        id: project._id.toString(),
        name: project.name || '',
        orgId: project.orgId || '',
      })),
    });
  } catch (error) {
    console.error(`[ORG-GRPC] ListProjects error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

export const startOrgGrpcServer = () => {
  const port = process.env.GRPC_PORT || '50052';
  const server = new grpc.Server();

  server.addService(orgProto.OrgService.service, {
    getOrganization,
    listProjects,
  });

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
    if (error) {
      console.error(`[ORG-GRPC] ✗ Failed to bind gRPC server: ${error.message}`);
      return;
    }
    console.log(`[ORG-GRPC] ✓ gRPC server running on 0.0.0.0:${boundPort}`);
  });

  return server;
};

export default startOrgGrpcServer;
