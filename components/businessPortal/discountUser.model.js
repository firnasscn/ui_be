const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const discountUser = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        autoPopulate: true
    },
    discount: {
        type: Number
    },
    status: {
        type: Number,
        default: 1 // 0 - deleted 1 - Active 
    }
}, { timestamps: true });
discountUser.plugin(autoPopulate);

const discountUsers = mongoose.model('discount_users', discountUser);

module.exports = discountUsers;