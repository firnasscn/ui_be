const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const unreadSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    anonymousId: {
        type: mongoose.Schema.ObjectId,
        ref: 'anonymous',
        autoPopulate: true
    },
    focusgroupId: {
        type: mongoose.Schema.ObjectId,
        ref: 'focusgroups',
        autoPopulate: true
    },
    count: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

unreadSchema.plugin(autoPopulate);
module.exports = mongoose.model('unreadchats', unreadSchema);