const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'paymentplans'
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teams'
    },
    amount: {
        type: Number //amount update in cent 1$ = 100cent
    },
    teamMembers: {
        type: Number
    },
    status: {
        type: Number,
        default: 1
    },
    duration: {
        type: Number
    }
}, { timestamps: true });
module.exports = mongoose.model('payment', PaymentSchema)
