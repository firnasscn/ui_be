const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const teamUserPayments = new mongoose.Schema({
    teamUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teamusers',
        autoPopulate: true
    },
    // userId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'users',
    //     autoPopulate: true
    // },
    price: {
        type: Number,
        required: true
    },
    teamPaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teampayments',
        autoPopulate: true
    },
    paymentMonth: {
        type: Date
    },
    paymentDate: {
        type: Date
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    status: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

teamUserPayments.plugin(autoPopulate)

module.exports = mongoose.model('teamUserPayment', teamUserPayments);