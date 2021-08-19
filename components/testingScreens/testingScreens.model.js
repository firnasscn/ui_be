const mongoose = require('mongoose');

const TestingScreensSchema = new mongoose.Schema({
    image: {
        type: String
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'testingQuestion',
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
    },
    parentProjectId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'projects'
    },
    parentScreenId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'testingscreens'
    },
}, { timestamps: true });

module.exports = mongoose.model('testingScreens', TestingScreensSchema);