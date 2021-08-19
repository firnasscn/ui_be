const mongoose = require('mongoose');

const RatingTypeSchema = new mongoose.Schema({
    name: {
        type: String
    },
    icon: {
        type: String
    },
    prependText: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('screenRatingType', RatingTypeSchema);