const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');

const userInvitedMembers = new mongoose.Schema({
    userId : {
        type : mongoose.Schema.ObjectId,
        ref : 'users'
    },
    email: {
        type: String,
        required: true,
    }
}, { timestamps: true }
);

userInvitedMembers.plugin(autoPopulate);
module.exports = mongoose.model('invitedUser', userInvitedMembers);