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
    ratingTypeId: {
        type: mongoose.Schema.ObjectId,
        ref: 'screenRatingType',
        autopopulate: {
            select: "name"
        }
    },
    comment: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'screenTags',
        autopopulate: {
            select: "-__v -name"
        }
    }],
    commentId: {
        type: mongoose.Schema.ObjectId,
        ref: 'comments',
        autopopulate: true
    },
    vote: {
        type: Number
    }
}, { timestamps: true }
);

Ratings.plugin(autoPopulate);
module.exports = mongoose.model('screenRating', Ratings);