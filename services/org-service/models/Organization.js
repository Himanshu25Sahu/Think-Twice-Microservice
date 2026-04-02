import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
    },
    members: [
      {
        userId: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member', 'viewer'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

export default mongoose.model('Organization', organizationSchema);
