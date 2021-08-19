const mongoose = require('mongoose');

const UsageReport = mongoose.Schema({
    date: {
        type: Date
    },
    userName: {
        type: String
    },
    email: {
        type: String
    },
    startDate: {
        type: Date
    },
    role: {
        type: String,
    },
    teamMates: {
        type: String
    },
    project: {
        type: String
    },
    focusGroup: {
        type: String
    },
    screenCount: {
        type: String
    },
    inspireScreen: {
        type: String
    },
    issue: {
        type: String
    },
    fixed: {
        type: String
    },
    completed: {
        type: String
    },
    chat: {
        type: String
    },
    invitedUser: {
        type: String
    },
}, { timestamps: true });

module.exports = mongoose.model('usage_report', UsageReport);