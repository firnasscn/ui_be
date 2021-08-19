const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const InteractionSchema = mongoose.Schema({
    screenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'screens',
        required: true
    },
    event: {
        type: String,
        required: true,
        default: 'click'
    },
    bounds: {
        x: {
            type: Number,
            required: true,
        },
        y: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true
        },
        height: {
            type: Number,
            required: true
        }
    },
    targetType: {
        type: String,
        default: 'screen',
        required: true
    },
    targetScreenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'screens'
    },
    targetUrl: {
        type: String
    },
    focusGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'focusgroups',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: {
            select: "email _id userName"
        }
    }
}, { timestamps: true });

InteractionSchema.plugin(autoPopulate);

module.exports = mongoose.model('interaction', InteractionSchema);