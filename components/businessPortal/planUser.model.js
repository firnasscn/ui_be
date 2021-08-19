const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const planUser = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autoPopulate: true
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'plans_businesses',
        autoPopulate: true
    },
    status: {
        type: Number,
        default: 1 // 0 - deleted 1 - Active 
    }
}, { timestamps: true });
planUser.plugin(autoPopulate);

const PlanUser = mongoose.model('plan_user', planUser);

module.exports = PlanUser;