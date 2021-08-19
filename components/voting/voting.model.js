const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const Voting = new mongoose.Schema({
    commentId: {
        type: mongoose.Schema.ObjectId,
        ref: 'comments'
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users'
    },
    vote: { // 0-novoting, 1-upvote, 2-downvote
        type: Number, 
        min : 0,
        max : 2,
        default : 0
    }
}, { timestamps: true }
);

Voting.plugin(autoPopulate);
module.exports = mongoose.model('voting', Voting);