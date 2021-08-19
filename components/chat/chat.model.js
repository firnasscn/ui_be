const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const ChatSchema = new mongoose.Schema({
    screenId: {
        type: mongoose.Schema.ObjectId,
        ref: 'screens',
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
    anonymousId: {
        type: mongoose.Schema.ObjectId,
        ref: 'anonymous',
        autoPopulate: true
    },
    rating: {
        type: Array
    },
    mailSent: {
        type: Number,
        default: 0
    },
    focusgroupId: {
        type: mongoose.Schema.ObjectId,
        ref: 'focusgroups',
        autoPopulate: true
    }
}, { timestamps: true });

ChatSchema.plugin(autoPopulate);
module.exports = mongoose.model('chats', ChatSchema);