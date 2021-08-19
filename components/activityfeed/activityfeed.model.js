const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const activityFeed = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.ObjectId,
        ref: 'projects',
        autoPopulate: true
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    message: {
        type: String
    },
    focusGroupId: {
        type: mongoose.Schema.ObjectId,
        ref: 'focusgroups',
        autoPopulate: true
    },
    type: {
        type: String,
        enum: ["addComment", "activity"]
    }
}, { timestamps: true }
);

activityFeed.plugin(autoPopulate);
module.exports = mongoose.model('activityfeed', activityFeed);