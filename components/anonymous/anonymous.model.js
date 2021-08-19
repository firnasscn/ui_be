const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const anonymous = new mongoose.Schema({
    userName: {
        type: String
    },
    email: {
        type: String
    },
    focusGroupId: {
        type: String
    },
    channelName: {
        type: String
    }
}, { timestamps: true }
);

anonymous.plugin(autoPopulate);
module.exports = mongoose.model('anonymous', anonymous);