const mongoose = require('mongoose');

const exportScreens = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: true
    },
    images: [{
        type: String

    }],
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project',
        autopopulate: true
    },
    focusGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'focusgroups',
        autopopulate: true
    },
    tagId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'projecttags',
        autopopulate: true
    },
    grayscale: {
        type: Boolean
    }
}, { timestamps: true });

module.exports = mongoose.model('exportScreens', exportScreens);