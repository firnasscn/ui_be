const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const teamUsers = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    loginTime: {
        type: Date
    },
    status: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

teamUsers.plugin(autoPopulate)

module.exports = mongoose.model('loginHistory', teamUsers);