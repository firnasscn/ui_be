const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate')

const payStructure = new mongoose.Schema({
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teams',
        autoPopulate: true
    },
    createdUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    membersCount: {
        type: Number
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'plans',
        autoPopulate: true
    },
    amount: {
        type: Number
    },
    status: {
        type: Number,
        default: 1
    },
    paymentDate: {
        type: Date
    },
    expireDate: {
        type: Date
    }
}, { timestamps: true });

payStructure.plugin(autoPopulate)

module.exports = mongoose.model('paystructures', payStructure);