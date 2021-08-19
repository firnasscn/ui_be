const mongoose = require('mongoose');

const screenTypes = mongoose.Schema({
    type: {
        type: String,
        required: true,
        unique: true
    }
},
    { timestamps: true }
);

const ScreenTypes = mongoose.model('screenTypes', screenTypes);

module.exports = ScreenTypes;