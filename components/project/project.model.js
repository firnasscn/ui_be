const mongoose = require('mongoose');
// const mongoosastic = require('mongoosastic')
// const esClient = require('../../utils/connection')
const industries = require('../industry/industry.model');
const ProjectSchema = new mongoose.Schema({
    projectName: {
        type: String,
        required: true,
    },
    industry: {
        type: mongoose.Schema.Types.ObjectId, ref: 'industry', autopopulate: true
    },
    tools: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'tools', autopopulate: true
    }],
    fonts: { type: mongoose.Schema.Types.ObjectId, ref: 'fonts', autopopulate: true },
    description: {
        type: String
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'users'
    },
    projectStatus: {
        type: Number,
        default: 1
    },
    channelName: {
        type: String
    }
}, { timestamps: true });
module.exports = mongoose.model('project', ProjectSchema)
