const mongoose = require('mongoose');

const FlaggedItemSchema = new mongoose.Schema({
    name: {
        type: String
    },
}, { timestamps: true });

module.exports = mongoose.model('flaggedItem', FlaggedItemSchema);