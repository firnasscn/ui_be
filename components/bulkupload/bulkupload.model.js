const mongoose = require('mongoose');

const bulkupload = mongoose.Schema({
    projectName: {
        type: String,
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'project'
    },
    originalFile: {
        type: String,
    },
    imageKey: {
        type: String
    }

},
    { timestamps: true }
);

const Bulkupload = mongoose.model('bulkupload', bulkupload);

module.exports = Bulkupload;