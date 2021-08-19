const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const Badge = new mongoose.Schema({
    name: {
        type: String
    },
}, { timestamps: true }
);

Badge.plugin(autoPopulate);
module.exports = mongoose.model('badges', Badge);