const mongoose = require('mongoose');

const TagsSchema = new mongoose.Schema({
    name: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('screenTags', TagsSchema);