const mongoose = require('mongoose');

const ProjectTeamMemberSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project'
    },
    projectTeamMember : {
        userId : {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        email : String,
        firstName : String
    },
    createdBy : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    }
}, { timestamps: true });

module.exports = mongoose.model('projectTeamMembers', ProjectTeamMemberSchema);