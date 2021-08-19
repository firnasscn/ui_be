const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const inspireScreen = new mongoose.Schema({
    screenId: {
        type: Object
    },
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    type: {
        type: String,
        enum: ["inspireScreen"]
    },
    projectId: {
        type: mongoose.Schema.ObjectId,
        ref: 'projects',
        autoPopulate: true
    }
}, { timestamps: true });

inspireScreen.plugin(autoPopulate);
module.exports = mongoose.model('inspireScreen', inspireScreen);