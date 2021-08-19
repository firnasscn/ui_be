const mongoose = require('mongoose');

const PaymentHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'users'
    },
    amount: {
        type: Number
    },
    planId: {
        type: mongoose.Schema.ObjectId,
        ref: 'paymentplans'
    },
    expiryDate: {
        type: Date
    },
    status: {
        type: String,
        default: 0 // 0- pending, 1-paid
    },
    orderId: {
        type: String
    },
    paymentId: {
        type: String
    },
}, { timestamps: true });

module.exports = mongoose.model('paymentHistory', PaymentHistorySchema);