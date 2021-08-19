const mongoose = require('mongoose');

const testingResponseSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'testingQuestion',
        autopopulate: true
    },
    screenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'testingScreens',
        autopopulate: true
    },
    testingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'abTesting',
        autopopulate: true
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName"
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('testingResponse', testingResponseSchema);