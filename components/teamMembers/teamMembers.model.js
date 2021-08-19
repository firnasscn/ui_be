const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const teamMembers = new mongoose.Schema({
    email: {
        type: String
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teams',
        //autoPopulate: true
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    teamUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teamUsers',
        autoPopulate: true
    },
    status: {
        //1- active 2-not active
        type: Number,
        enum: [1, 2],
        default: 1
    }
}, { timestamps: true });

teamMembers.plugin(autoPopulate)

module.exports = mongoose.model('teamMembers', teamMembers);