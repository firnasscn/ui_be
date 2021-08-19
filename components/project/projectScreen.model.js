const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');
const mongoosastic = require('mongoosastic')

const ProjectScreen = mongoose.Schema({
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
    forfocusgroup: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('project_screen', ProjectScreen);