const mongoose = require('mongoose');

const FlagSchema = new mongoose.Schema({
    screenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'screens',
        autopopulate: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: true
    }
}, { timestamps: true });

module.exports = mongoose.model('flag', FlagSchema);