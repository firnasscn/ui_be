const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const teamUsers = new mongoose.Schema({
    email: {
        type: String
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
    lastPaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teamuserpayments',
        autoPopulate: true
    },
    planExpiryDate: {
        type: Date
    },
    status: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

teamUsers.plugin(autoPopulate)

module.exports = mongoose.model('teamUsers', teamUsers);