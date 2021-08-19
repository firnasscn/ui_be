require("dotenv").config();

var aws = require('aws-sdk')
var multer = require('multer')
var multerS3 = require('multer-s3')
const helper = require('../utils/s3Upload');
const crypto = require('crypto-random-string');

var s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: process.env.AWS_DEFAULT_REGION
})
let lStrBucketName = '';
function bytesToSize(bytes) {
    if (bytes == 0) return 0;
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2);
};

function fileUpload() {
    const methods = {

        upload: multer({
            fileFilter: function (req, file, cb) {
                try {
                    let lIntFileSize = bytesToSize(file.size || 0)
                    if ((file.mimetype == 'image/png' || file.mimetype == 'image/jpeg' || file.mimetype == 'image/jpg') && lIntFileSize <= 5) {
                        cb(null, true)
                    } else {
                        req.fileValidationErr = 'Please upload only image files and file limit should be less than 5mb'
                        return cb(null, false, new Error(req.fileValidationErr))
                    }
                } catch (e) {
                    console.log(e)
                }
            },
            storage: multerS3({
                s3: s3,
                bucket: (req, file, cb) => {
                    let bucketName = req.headers.projectname
                    cb(null, `${process.env.AWS_BUCKET}/${bucketName}`);
                },
                contentType: multerS3.AUTO_CONTENT_TYPE,
                metadata: function (req, file, cb) {
                    lStrBucketName = file.fieldname;
                    cb(null, { fieldName: `${file.fieldname}` });
                },
                key: function (req, file, cb) {
                    cb(null, `${crypto(12)}`)
                }
            })
        })
    }
    return Object.freeze(methods)
}

module.exports = fileUpload()
