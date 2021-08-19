const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');
const Notifications = mongoose.Schema({
    focusGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'focusgroups',
        autopopulate: {
            select: "-groupstatus -description -invitedMembers -createdAt -updatedAt -__v -joinedMembers -createdUser"
        }
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project',
        autopopulate: true
    },
    testingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'abTesting',
        autopopulate: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teams',
        autopopulate: true
    },
    notificationType: {
        type: String,
        enum: ['newFG', 'addMembers', 'addComment', 'deleteFG', 'addRating', 'onScreenComment', 'newProject', 'updateMembers', 'paymentSuccess', 'paymentExpiry', 'generalNotification', 'projectNotification', 'paymentNotification', 'focusGroupNotification']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName"
        }
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "_id firstName lastName userName email profilePicture"
        }
    },
    invitationToken: {
        type: String
    },
    message: {
        type: String
    },
    isSeen: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
Notifications.plugin(autoPopulate);
const Pattern_Notification = mongoose.model('notifications', Notifications);

module.exports = Pattern_Notification;