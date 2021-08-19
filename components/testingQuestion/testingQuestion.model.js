const mongoose = require('mongoose');

const TestingQuestionSchema = new mongoose.Schema({
    question: {
        type: String
    },
    testingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'abtestings',
        autopopulate: {
            select: "testingName description _id"
        }
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName"
        }
    },
    comments: [{
        comment: {
            type: String,

        }, userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            autopopulate: true
        },

    }],

    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('testingQuestion', TestingQuestionSchema);