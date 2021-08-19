require("dotenv").config();

const mime = require('mime-types');
const hash = require('object-hash');
const path = require('path');
/*--------AWS Configuration---------*/
let lObjGetS3BucketConfig = process.env;
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: lObjGetS3BucketConfig.AWS_ACCESS_KEY_ID,
    secretAccessKey: lObjGetS3BucketConfig.AWS_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: lObjGetS3BucketConfig.AWS_DEFAULT_REGION
});

//Graphic Magicks
const gm = require("gm").subClass({ imageMagick: true });

let lAryRanges = ['150', '450', '700'];

let uploadController = {
    s3FileUpload: async (lObjData, dstKey) => {
        console.log("s3FileUpload");
        // console.log("lObjData", lObjData);
        console.log("dstKey", dstKey);
        try {
            //Upload the thumbnail images to s3 bucket
            let img = await s3.upload(
                {
                    Bucket: lObjGetS3BucketConfig.AWS_BUCKET,
                    Key: dstKey,
                    ContentType: 'image/jpeg',
                    Body: lObjData,
                    ACL: "private",
                    Metadata: {
                        thumbnail: "TRUE"
                    }
                }
            ).promise();
            return img;
        } catch (e) {
            console.log(e);
            return e;
        }
    },

    s3GetObject: async dstKey => {
        console.log("s3GetObject", process.env.AWS_BUCKET);
        console.log("s3GetObject", dstKey);
        try {
            //Retrieve all the images as signed url
            return await s3.getObject({
                Bucket: lObjGetS3BucketConfig.AWS_BUCKET,
                Key: dstKey
            });
        } catch (e) {
            console.log(e);
            return e;
        }
    },
    s3GetSignedURL: async (dstKey, folder) => {
        console.log("s3GetSignedURL", dstKey);
        console.log("AWS_BUCKET", `${lObjGetS3BucketConfig.AWS_BUCKET}/${folder}`);
        try {
            //Retrieve all the images as signed url
            return await s3.getSignedUrl("getObject", {
                Bucket: `${lObjGetS3BucketConfig.AWS_BUCKET}/${folder}`,
                Key: dstKey,
                Expires: 14400
            });
        } catch (e) {
            console.log(e);
            return e;
        }
    },

    s3DeleteImage: async (key) => {
        console.log("s3DeleteImage");

        try {
            return await s3.deleteObject({
                Bucket: `${lObjGetS3BucketConfig.AWS_BUCKET}/${folder}`,
                Key: key
            });
        } catch (e) {
            console.log(e);
            return e;
        }
    },

    s3UploadFile: async (dstKeyId, type) => {
        try {
            const file = context.params.file;

            let lObjData = file.buffer;
            let dstKeyId = `${hash(file.originalname) + new Date().getTime()
                }.${mime.extension(file.mimetype)}`;

            let dstKey = `patterns/${type}/${dstKeyId}`

            let imageUpload = await uploadController.s3FileUpload(lObjData, dstKey);
            context.data.profilePicture = imageUpload.Key;

        } catch (e) {
            console.log(e);
        }
    },
    generateThumbanils: async (context, res) => {
        context.pipe(context.busboy)
        try {
            if (!!context) {
                context.busboy.on('file', function (fieldname, file, filename) {
                    let lAryResponsiveImages = [];
                    var promise1 = new Promise(async (resolve, reject) => {
                        // let dstKeyId = `${hash(filename) + new Date().getTime()
                        //     }.${mime.extension(file.mimetype)}`;
                        let dstKeyId = `${new Date().getTime()
                            }_original${path.extname(filename)}`;
                        console.log(dstKeyId)
                        let dstKey = `${fieldname} /${dstKeyId}`

                        let imageUpload = await uploadController.s3FileUpload(file, dstKey);
                        context.data.images = imageUpload.Key;
                        context.data.dstKey = dstKeyId;

                        resolve(context)
                    });

                    var promise2 = new Promise(async (resolve, reject) => {
                        context.gAryBufferData = [];
                        let image = gm(file);
                        console.log(typeof (image), image)
                        image.toBuffer();
                        console.log(typeof (image), image)
                        image.size(async (err, size) => {
                            console.log(size)
                            /*
                            * scalingFactor should be calculated to fit either the width or the height
                            * within 150x150 optimally, keeping the aspect ratio. Additionally, if the image 
                            * is smaller than 150px in both dimensions, keep the original image size and just 
                            * convert to png for the thumbnail's display
                            */
                            for (let v of lAryRanges) {
                                let scalingFactor = Math.min(
                                    1,
                                    v / size.width,
                                    v / size.height
                                ),
                                    width = scalingFactor * size.width,
                                    height = scalingFactor * size.height;

                                await (new Promise((success, error) => {

                                    console.log(typeof image)
                                    image.resize(width, height).stream('webp', (err, buffer) => {
                                        if (err) {
                                            reject(err);
                                        } else {
                                            context.gAryBufferData.push(buffer)
                                            success(true)
                                        }
                                        fs.unlinkSync('./tmp.png');
                                    });
                                }))
                            }
                            resolve(context);
                        });
                    }).then(async context => {
                        console.log(context.gAryBufferData, "FILES")
                        let dstKeyId = context.data.dstKey;
                        for (let index in context.gAryBufferData) {
                            let lObjData = context.gAryBufferData[index];
                            let dstKey = 'screens/' + lObjGetS3BucketConfig.THUMB_KEY_PREFIX + lAryRanges[index] + 'x' + lAryRanges[index] + '/' + dstKeyId;

                            let s3UploadRes = await uploadController.s3FileUpload(lObjData, dstKey)
                            lAryResponsiveImages.push(s3UploadRes.Key)
                        }
                        context.data.responsiveImages = lAryResponsiveImages;
                        return context;
                    });

                    return Promise.all([promise1, promise2]);
                })
            }
        } catch (e) {
            console.log(e);
        }
    }


    /* generateThumbanils: async (context, type) => {
        console.log("generateThumbanils");
        try {
            if (!!context) {
                let lAryResponsiveImages = [];
 
                const file = context.params.file;
                var promise1 = new Promise(async (resolve, reject) => {
                    console.log("promise1")
                    let lObjData = file.buffer;
                    let dstKeyId = `${hash(file.originalname) + new Date().getTime()
                        }.${mime.extension(file.mimetype)}`;
 
                    let dstKey = `patterns/${type}/${dstKeyId}`
                    console.log("dstKey ==", dstKey)
 
                    let imageUpload = await uploadController.s3FileUpload(lObjData, dstKey);
                    console.log("imageUpload", imageUpload.Key)
                    context.data.images = imageUpload.Key;
                    context.data.dstKey = dstKeyId;
                    console.log("****************", context.data);
                    resolve(context)
                }).then(async context => {
                    await new Promise(async (resolve, reject) => {
                        context.gAryBufferData = [];
                        let image = gm(file.buffer);
                        await (new Promise(async (val1, val2) => {
                            await image.size(async (err, size) => {
                                console.log("promise2.1")
                                for (let v of lAryRanges) {
                                    console.log("lAryRanges", v)
                                    let scalingFactor = Math.min(
                                        1,
                                        v / size.width,
                                        v / size.height
                                    ),
                                        width = scalingFactor * size.width,
                                        height = scalingFactor * size.height;
 
                                    await (new Promise((success, error) => {
                                        image.resize(width, height).toBuffer("png", (err, buffer) => {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                console.log("buffer", buffer)
                                                context.gAryBufferData.push(buffer)
                                                success(true)
                                            }
                                        });
                                    }))
                                }
                                return context
                            }).then(val => {
                                console.log("SSSSSSSSSSSSSSSSSSSSS", val)
                                val1(val);
                            });
                        }));
                        console.log("frfrfr === ", context.data)
                        resolve(context);
                    })
                    return context;
                }).then(async context => {
                    console.log('(*********************)', context.gAryBufferData);
                    let dstKeyId = context.data.dstKey;
                    for (let index in context.gAryBufferData) {
                        let lObjData = context.gAryBufferData[index];
                        let dstKey = 'patterns/' + type + '/' + lObjGetS3BucketConfig.THUMB_KEY_PREFIX + lAryRanges[index] + 'x' + lAryRanges[index] + '/' + dstKeyId;
                        console.log("s3UploadRes.key BEFORE", s3UploadRes);
                        let s3UploadRes = await uploadController.s3FileUpload(lObjData, dstKey)
                        console.log("s3UploadRes.key==", s3UploadRes);
                        lAryResponsiveImages.push(s3UploadRes.Key)
                    }
                    context.data.responsiveImages = lAryResponsiveImages;
                    return context;
                });
 
                return Promise.all([promise1]);
            }
        } catch (e) {
            console.log(e);
        }
    } */
}
module.exports = uploadController;
