const mongoose = require('mongoose');
const Schema = mongoose.Schema

const styleguidemodel = new mongoose.Schema({
    colour: [],
    font: [],
    projectId: {
        type: Schema.Types.ObjectId,
        ref: "project"
    },
    status: {
        type: Number,
        default: 1 //1 active 2 deleted
    }
}, { timestamps: true })


module.exports = mongoose.model('styleguide', styleguidemodel)