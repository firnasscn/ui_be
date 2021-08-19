const mongoose = require('mongoose');

const hotSpot = mongoose.Schema({
    screenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'screens'
    },
    focusgroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'focusgroups'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName firstName lastName profilePicture profilePic"
        }
    },
    anonymousId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'anonymous',
        autopopulate: {
            select: "email _id userName channelName"
        }
    },
    position: {
        top: {
            type: String
        },
        left: {
            type: String
        }
    },
    comment: {
        type: String
    },
    dueDate: { type: Date },
    status: {
        type: Number,
        default: 1 //0-Deleted,1-Active
    },
    commentRes: [{
        comment: {
            type: String,

        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            autopopulate: true
        },
        anonymousId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'anonymous',
            autopopulate: true
        },
        createdAt: { type: Date }

    }],
    mailSent: {
        type: Number,
        default: 0
    },
    actionId: {
        type: mongoose.Schema.ObjectId,
        ref: 'hostspotAction',
        autopopulate: {
            select: "name"
        }
    },
    flagId: {
        type: mongoose.Schema.ObjectId,
        ref: 'flaggeditems',
        autopopulate: {
            select: "name"
        }
    },
    flagStatus: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });


const HotSpot = mongoose.model('hotspot', hotSpot);

module.exports = HotSpot;