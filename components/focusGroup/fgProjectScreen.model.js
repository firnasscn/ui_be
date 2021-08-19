const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');
const mongoosastic = require('mongoosastic')

const FGProjectScreen = mongoose.Schema({
    projectScreenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project_screen',
        autopopulate: true
    },
    screenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'screens',
        autopopulate: true
    },
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
    screenName: {
        type: String,
    },
    sequence: {
        type: Number
    },
    description: {
        type: String
    },
}, { timestamps: true });

module.exports = mongoose.model('fg_project_screen', FGProjectScreen);