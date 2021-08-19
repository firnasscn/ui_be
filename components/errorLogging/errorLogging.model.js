const mongoose = require('mongoose');

const ErrorLogging = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: true
    },
    requestPath: {
        type: String
    },
    resposne: {
        type: Object
    },
    status: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

module.exports = mongoose.model('error_logging', ErrorLogging);