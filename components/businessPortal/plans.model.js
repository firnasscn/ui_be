const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const FocusGroupSchema = mongoose.Schema({
    planName: {
        type: String,
        required: true,
    },
    basePrice: {
        type: Number,
        required: true
    },
    threshold: {
        type: Number,
        default: 0
    },
    maxThreshold: {
        type: Number,
        default: 0
    },
    status: {
        type: Number,
        default: 1
    }
}, { timestamps: true });
FocusGroupSchema.plugin(autoPopulate);

const FocusGroup = mongoose.model('plans_business', FocusGroupSchema);

module.exports = FocusGroup;