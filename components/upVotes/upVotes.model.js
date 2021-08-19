const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const UpVote = new mongoose.Schema({
    screenId: {
        type: mongoose.Schema.ObjectId,
        ref: 'screens'
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users'
    },
    focusGroupId: {
        type: mongoose.Schema.ObjectId,
        ref: 'focusgroups'
    },
    vote: {
        type: Number,
    }
}, { timestamps: true });

UpVote.plugin(autoPopulate);
module.exports = mongoose.model('upVote', UpVote);