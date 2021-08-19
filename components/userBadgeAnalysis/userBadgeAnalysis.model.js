const mongoose = require('mongoose');

const RatingTypeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users', autopopulate: true
    },
    screensViewed: {
        type: Number,
        default: 0
    },
    screensCommented: {
        type: Number,
        default: 0
    },
    screensRated: {
        type: Number,
        default: 0
    },
    screensPublished: {
        type: Number,
        default: 0
    },
    inspirationTime: {
        type: Number,
        default: 0
    },
    commentsReceived: {
        type: Number,
        default: 0
    },
    ratingsReceived: {
        type: Number,
        default: 0
    },
    avgRatingReceived: {
        type: Number,
        default: 0
    },
    focusGroupParticipated: {
        type: Number,
        default: 0
    },
    ABTestingArticipated: {
        type: Number,
        default: 0
    },
    badgeId : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'badges',
        autopopulate: true
    }

}, { timestamps: true });

module.exports = mongoose.model('userBadgeAnalysis', RatingTypeSchema);