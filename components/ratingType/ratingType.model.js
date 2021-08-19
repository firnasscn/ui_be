const mongoose = require('mongoose');

const RatingTypeSchema = new mongoose.Schema({
    name: {
        type: String
    },
    colorCode: {
        type: String
    },
    pointerBg: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('ratingType', RatingTypeSchema);