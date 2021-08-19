const mongoose = require('mongoose');

const FontsSchema = new mongoose.Schema({
    name: {
        type: String
    }

}, { timestamps: true });

module.exports = mongoose.model('fonts', FontsSchema);