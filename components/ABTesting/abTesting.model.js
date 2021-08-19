const mongoose = require('mongoose');

const abTesting = mongoose.Schema({
  testingName: {
    type: String,
    required: true
  },
  description: {
    type: String,
  },
  type: {
    type: String,
    enum: ["mobile", "web"],
  },
  createdUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    autopopulate: {
      select: "email _id userName"
    }
  },
  status: {
    type: Number,
    default: 0 // 0 - save , 1- publish, 2 -closed, 3-Inactive(deleted), 4-Archieve(Old Status)
    // 0- Delete 1- published 2- Archieve 3-closed 4-saved(New Status)
  },
  joinedMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    autopopulate: {
      select: "email _id userName profilePicture profilePic"
    }
  }],
  invitedMembers: [{
    email: { type: String },
    invitationToken: { type: String },
    acceptedTime: { type: Date }
  }],
  response: {
    type: Number,
    default: 0
  }

},
  { timestamps: true }
);

const ABTesting = mongoose.model('abTesting', abTesting);

module.exports = ABTesting;