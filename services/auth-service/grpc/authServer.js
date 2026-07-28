import path from 'path';
import { fileURLToPath } from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

const toUserMessage = (user) => ({
  id: user._id.toString(),
  name: user.name || '',
  email: user.email || '',
});

// Mirrors authController.getMe (header-based lookup path).
const getUser = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  try {
    const user = await User.findById(call.request.userId);
    if (!user) {
      return callback(null, { found: false, user: null });
    }
    return callback(null, { found: true, user: toUserMessage(user) });
  } catch (error) {
    console.error(`[AUTH-GRPC] GetUser error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

// Mirrors authController.addOrganization.
const addOrganization = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  const { userId, orgId } = call.request;
  try {
    if (!userId || !orgId) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'User ID and Organization ID are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
    }

    const orgIdString = orgId.toString();
    const alreadyMember = user.organizations.some((org) => org.toString() === orgIdString);
    if (alreadyMember) {
      return callback({ code: grpc.status.ALREADY_EXISTS, message: 'User is already a member of this organization' });
    }

    user.organizations.push(orgId);
    if (user.organizations.length === 1) {
      user.activeOrg = orgId;
    }
    await user.save();

    console.log(`[AUTH-GRPC] Organization added: ${userId} trace=${traceId}`);
    return callback(null, { success: true, message: 'Organization added to user' });
  } catch (error) {
    console.error(`[AUTH-GRPC] AddOrganization error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

// Mirrors authController.removeOrganization.
const removeOrganization = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  const { userId, orgId } = call.request;
  try {
    if (!userId || !orgId) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'User ID and Organization ID are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
    }

    const orgIndex = user.organizations.findIndex((org) => org.toString() === orgId.toString());
    if (orgIndex === -1) {
      return callback({ code: grpc.status.NOT_FOUND, message: "Organization not found in user's organizations" });
    }

    user.organizations.splice(orgIndex, 1);

    if (user.activeOrg && user.activeOrg.toString() === orgId.toString()) {
      user.activeOrg = user.organizations.length > 0 ? user.organizations[0] : null;
      user.activeProject = null;
    }

    await user.save();

    console.log(`[AUTH-GRPC] Organization removed: ${userId} trace=${traceId}`);
    return callback(null, { success: true, message: 'Organization removed from user' });
  } catch (error) {
    console.error(`[AUTH-GRPC] RemoveOrganization error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

// Mirrors authController.updateActiveOrg.
const updateActiveOrg = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  const { userId, orgId } = call.request;
  try {
    if (!orgId) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Organization ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
    }

    const orgIdString = orgId.toString();
    const isMember = user.organizations.some((org) => org.toString() === orgIdString);
    if (!isMember) {
      return callback({ code: grpc.status.PERMISSION_DENIED, message: 'User is not a member of this organization' });
    }

    user.activeOrg = orgId;
    user.activeProject = null;
    await user.save();

    console.log(`[AUTH-GRPC] Active org updated: ${userId} trace=${traceId}`);
    return callback(null, { success: true, message: 'Active organization updated' });
  } catch (error) {
    console.error(`[AUTH-GRPC] UpdateActiveOrg error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

// Mirrors authController.updateActiveProject.
const updateActiveProject = async (call, callback) => {
  const traceId = call.request.traceId || 'grpc';
  const { userId, projectId } = call.request;
  try {
    if (!projectId) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Project ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
    }

    if (!user.activeOrg) {
      return callback({ code: grpc.status.FAILED_PRECONDITION, message: 'Active organization must be set before switching project' });
    }

    user.activeProject = projectId.toString();
    await user.save();

    console.log(`[AUTH-GRPC] Active project updated: ${userId} trace=${traceId}`);
    return callback(null, { success: true, message: 'Active project updated' });
  } catch (error) {
    console.error(`[AUTH-GRPC] UpdateActiveProject error: ${error.message} trace=${traceId}`);
    return callback({ code: grpc.status.INTERNAL, message: error.message });
  }
};

export const startAuthGrpcServer = () => {
  const port = process.env.GRPC_PORT || '50051';
  const server = new grpc.Server();

  server.addService(authProto.AuthService.service, {
    getUser,
    addOrganization,
    removeOrganization,
    updateActiveOrg,
    updateActiveProject,
  });

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
    if (error) {
      console.error(`[AUTH-GRPC] ✗ Failed to bind gRPC server: ${error.message}`);
      return;
    }
    console.log(`[AUTH-GRPC] ✓ gRPC server running on 0.0.0.0:${boundPort}`);
  });

  return server;
};

export default startAuthGrpcServer;
