// screens-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');
// const mongoosastic = require('mongoosastic')
const FocusGroupSchema = mongoose.Schema({
    groupName: {
        type: String,
        required: true,
    },
    description: {
        type: String
    },
    invitedMembers: [{
        email: { type: String },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            autoPopulate: {
                select: "email _id userName firstName lastName"
            }
        },
        invitationToken: { type: String, default: '' },
        acceptedTime: { type: Date, default: Date.now }
    }],
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName"
        }
    },
    joinedMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName profilePicture"
        }
    }],
    type: {
        type: String,
        enum: ["mobile", "web", "other"]
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project'
    },
    groupstatus: {
        type: Number,
        default: 1, // 1-Active,0-InActive(Deleted),2-Archieve,3-Completed
        // es_indexed: true
    },
    isPublic: {
        type: Boolean,
        default: true //changed for all user access
    },
    channelName: {
        type: String
    },
    anonymousId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'anonymous',
        autopopulate: {
            select: "_id name channelName email" /**FIrnaas added email for mail notification of comments */
        }
    }]
}, { timestamps: true });
FocusGroupSchema.plugin(autoPopulate);
// FocusGroupSchema.index({ 'userId': 1, 'groupName': 1, 'joinedMembers': 1 })
const FocusGroup = mongoose.model('focusgroups', FocusGroupSchema);

module.exports = FocusGroup;