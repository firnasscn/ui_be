const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const BadgeProperties = new mongoose.Schema({
    screensViewed: {
        type: String
    },
    screensCommented: {
        type: Number
    },
    screensRated: {
        type: Number
    },
    screensPublished: {
        type: Number
    },
    inspirationTime: {
        type: String
    },
    commentsReceived: {
        type: Number
    },
    ratingsReceived: {
        type: Number
    },
    avgRatingsReceived: {
        type: Number
    },
    FocusgroupsParticipated: {
        type: Number
    },
    ABTestsParticipated: {
        type: Number
    },
    badgeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'badges',
        autopopulate: true
    }

}, { timestamps: true }
);

BadgeProperties.plugin(autoPopulate);
module.exports = mongoose.model('badgeProperties', BadgeProperties);