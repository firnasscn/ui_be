const mongoose = require('mongoose');

const ticket = mongoose.Schema({
    hotspotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hotspots',
        autopopulate: true
    },
    raisedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: true
    },
    assignedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        autopopulate: true
    },
    status: {
        type: Number,
        default: 1
    },
    groupBy: {
        type: String,
        default: 'Ticket'
    }
}, { timestamps: true });


const Ticket = mongoose.model('ticketAssign', ticket);

module.exports = Ticket;