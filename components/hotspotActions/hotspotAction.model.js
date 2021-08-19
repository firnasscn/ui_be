const mongoose = require('mongoose');

const HotspotActionSchema = new mongoose.Schema({
    name: {
        type: String
    },
}, { timestamps: true });

module.exports = mongoose.model('hostspotAction', HotspotActionSchema);