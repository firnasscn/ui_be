const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const searchList = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users'
    },
    searchName: {
        type: String
    }
}, { timestamps: true }
);

searchList.plugin(autoPopulate);
module.exports = mongoose.model('searchlist', searchList);