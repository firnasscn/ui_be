const mongoose = require('mongoose');

const ToolsSchema = new mongoose.Schema({
    name: {
        type: String
    },
    icon: {
        type: String
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
    }
}, { timestamps: true });

module.exports = mongoose.model('tools', ToolsSchema);