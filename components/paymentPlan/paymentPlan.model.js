const mongoose = require('mongoose');

const PaymentPlanSchema = new mongoose.Schema({
    name: {
        type: String
    },
    amount: {
        type: Number
    },
    description: {
        type: String
    },
    duration: {
        type: String
    },
    status: {
        type: Boolean,
        default: true,
    },
    planId: {
        type: String
    },
    productId: {
        type: String
    },
    membersCount: {
        type: String
    },
    focusGroupCount: {
        type: String
    },
    abTestingCount: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('paymentPlan', PaymentPlanSchema);