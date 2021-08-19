const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const teamPayments = new mongoose.Schema({
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
    teamDetails: [{
        teamUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'teamusers',
            autoPopulate: true
        },
        email: {
            type: String
        },
        startDate: {
            type: Date
        },
        endDate: {
            type: Date
        },
        noOfDays: {
            type: Number
        },
        price: {
            type: Number
        }
    }],
    price: {
        type: Number,
        required: true
    },
    //paymentId from stripe
    paymentIntentId: {
        type: String,
        //required: true
    },
    paymentDate: {
        type: Date
    },
    //paymentStatus 1 - payment initiated 2 - payment completed
    paymentStatus: {
        type: Number,
        default: 1
    },
    client_secret: {
        type: String
    },
    status: {
        type: Number,
        default: 1
    },
    transactionId: {
        type: String
    }
}, { timestamps: true });

teamPayments.plugin(autoPopulate)

module.exports = mongoose.model('teamPayment', teamPayments);