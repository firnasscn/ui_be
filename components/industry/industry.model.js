const mongoose = require('mongoose');
const IndustrySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        es_type: 'text',
        es_indexed: true
    }
}, { timestamps: true });

const Industries = mongoose.model('industry', IndustrySchema)
module.exports = Industries
//     stream = industries.synchronize({}, { saveOnSynchronize: true })
//     , count = 0;
// stream.on('data', function (err, doc) {
//     count++;
// });
// stream.on('close', function () {
// });
// stream.on('error', function (err) {
//     console.log(err);
// });