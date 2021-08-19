let mongoose = require('mongoose');
let autoPopulate = require('mongoose-autopopulate');

let ProjectTag = new mongoose.Schema({
    tagName: {
        type: String
    },
    description: {
        type: String
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'project'
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    status: {
        type: Number,
        default: 1
    }
})

ProjectTag.plugin(autoPopulate);

module.exports = mongoose.model('projecttags', ProjectTag)