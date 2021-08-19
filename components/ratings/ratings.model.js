const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const Ratings = new mongoose.Schema({
    screenId: {
        type: mongoose.Schema.ObjectId,
        ref: 'screens'
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users'
    },
    anonymousId: {
        type: mongoose.Schema.ObjectId,
        ref: 'anonymous'
    },
    ratingTypeId: {
        type: mongoose.Schema.ObjectId,
        ref: 'ratingType',
        autopopulate: {
            select: "name"
        }
    },
    focusGroupId: {
        type: mongoose.Schema.ObjectId,
        ref: 'focusgroups'
    },
    comment: {
        type: String
    },
    commentId: {
        type: mongoose.Schema.ObjectId,
        ref: 'comments',
        autopopulate: true
    },
    vote: {
        type: Number
    },
    mailSent: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

Ratings.plugin(autoPopulate);
module.exports = mongoose.model('ratings', Ratings);