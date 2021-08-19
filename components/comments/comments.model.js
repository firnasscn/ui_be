const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const Comment = new mongoose.Schema({
    screenId: {
        type: mongoose.Schema.ObjectId,
        ref: 'screens',
        autopopulate: {
            select: "screenName _id type"
        }
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName"
        }
    },
    comments: {
        type: String,
    },
    parentId: {
        type: mongoose.Schema.ObjectId,
        ref: 'comments',
        autopopulate: true
    },
    upVote: {
        type: Number
    },
    downVote: {
        type: Number
    },
    status: {
        type: Number,
        default: 1

    }
},
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    });

Comment.plugin(autoPopulate);
module.exports = mongoose.model('comments', Comment);