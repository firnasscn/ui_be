const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const chatCounTrack = new mongoose.Schema({
    userId: {
        type: String
    },
    focusGroupId: { 
        type: String
    },
    screenId: {
        type: String
    },
    count: {
        type: Number,
        default: 0
    }
}, { timestamps: true }
);

chatCounTrack.plugin(autoPopulate);
module.exports = mongoose.model('chatCounTrack', chatCounTrack);