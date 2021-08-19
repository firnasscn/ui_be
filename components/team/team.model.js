const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const teamSchema = new mongoose.Schema({
    teamName: {
        type: String
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    description: {
        type: String
    },
    link: {
        type: String
    },
    team_status: {
        type: Number,
        default: 1
    },
    status: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

teamSchema.plugin(autoPopulate)

module.exports = mongoose.model('teams', teamSchema);