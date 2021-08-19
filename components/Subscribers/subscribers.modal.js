const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const subscribers = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    signUpStatus: {
        type: Number,
        default: 0
    },
    approvedStatus: {
        type: Number,
        default: 0
    },
    emailStatus: {
        type: Number,
        default: 0
    }

}, { timestamps: true });

subscribers.plugin(autoPopulate);
module.exports = mongoose.model('subscriber', subscribers);