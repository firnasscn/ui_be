const mongoose = require('mongoose');

const TagsSchema = new mongoose.Schema({
    name: {
        type: String
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
    }
}, { timestamps: true });

module.exports = mongoose.model('tags', TagsSchema);