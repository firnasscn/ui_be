let Projects = require('../project/project.model');
let Screens = require('../screens/screens.model');
let Response = require('../../utils/response');
let ProjectTag = require('./projecttag.model');

function projectTag() {
    const methods = {
        createTag: async (req, res) => {
            try {

                let Schema = Joi.object().keys({
                    tagName: Joi.string().required(),
                    projectId: Joi.string().required(),
                    description: Joi.string().allow(''),
                    screenId: Joi.array().required(),
                })

                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let tagName = req.body.tagName;
                let description = req.body.description;
                let screenId = req.body.screenId;

                let checkUser = await ProjectTag.find({ tagName: tagName, CreatedUser: req.user._id, status: 1 });
                if (!checkUser) {
                    return Response.badValues(res, 'You are already created same name Tag')
                }

                let Tag = await ProjectTag.create({
                    tagName: tagName,
                    description: description,
                    projectId: req.body.projectId,
                    createdUser: req.user._id
                })

                for (let screen of screenId) {
                    let getScreenDetails = await Screens.findOne({ _id: screen }, { _id: 1, projectId: 1, type: 1, screenName: 1, image: 1, userId: 1, colorPalette: 1 });

                    if (getScreenDetails) {
                        // let obj = {
                        //     type: getScreenDetails.type,
                        //     screenName: getScreenDetails.screenName,
                        //     colorPalette: getScreenDetails.colorPalette,
                        //     parentScreen: getScreenDetails._id,
                        //     parentScreenId: getScreenDetails.projectId,
                        //     image: getScreenDetails.image,
                        //     inspire: getScreenDetails.inspire,
                        //     tagId: Tag._id,
                        //     userId: req.user._id
                        // }
                        // await Screens.create(obj);

                        await Screens.updateOne({ _id: screen }, { tagId: Tag._id, })
                    }
                }

                let TagDetails = await ProjectTag.aggregate([
                    { $match: { _id: Tag._id, status: 1 } },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'tagId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            tagName: { $first: '$tagName' },
                            description: { $first: '$description' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email',
                                    userName: '$users.userName'
                                }
                            },
                            screens: {
                                $addToSet: {
                                    _id: '$screens._id',
                                    screenName: '$screens.screenName',
                                    image: '$screens.image',
                                    status: '$screens.screenStatus'
                                }
                            }
                        }
                    }
                ])
                return Response.success(res, TagDetails, 'Tag created successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        addImages: async (req, res) => {
            try {
                let screenId = req.body.screenId;
                let tagId = req.body.tagId;

                let checkUser = await ProjectTag.findOne({ _id: tagId, createdUser: req.user._id, status: 1 });
                if (!checkUser) {
                    return Response.badValues(res, 'You are not having permission to add screens')
                }

                for (let screen of screenId) {
                    let getScreenDetails = await Screens.findOne({ _id: screen }, { _id: 1, projectId: 1, type: 1, screenName: 1, image: 1, userId: 1, colorPalette: 1 });

                    if (getScreenDetails) {
                        // let obj = {
                        //     type: getScreenDetails.type,
                        //     screenName: getScreenDetails.screenName,
                        //     colorPalette: getScreenDetails.colorPalette,
                        //     parentScreen: getScreenDetails._id,
                        //     parentScreenId: getScreenDetails.projectId,
                        //     image: getScreenDetails.image,
                        //     inspire: getScreenDetails.inspire,
                        //     tagId: tagId,
                        //     userId: req.user._id
                        // }
                        // await Screens.create(obj);

                        await Screens.updateOne({ _id: screen }, { tagId: tagId })
                    }
                }

                let TagDetails = await ProjectTag.aggregate([
                    { $match: { _id: tagId, status: 1 } },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'tagId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            tagName: { $first: '$tagName' },
                            description: { $first: '$description' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email',
                                    userName: '$users.userName'
                                }
                            },
                            screens: {
                                $addToSet: {
                                    _id: '$screens._id',
                                    screenName: '$screens.screenName',
                                    image: '$screens.image',
                                    status: '$screens.screenStatus'
                                }
                            }
                        }
                    }
                ])
                return Response.success(res, TagDetails, 'Tag created successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        removeScreen: async (req, res) => {
            try {
                let screenId = req.body.screenId;
                let tagId = req.body.tagId;

                let checkUser = await ProjectTag.findOne({ _id: tagId, createdUser: req.user._id, status: 1 });
                if (!checkUser) {
                    return Response.badValues(res, 'You are not have permission to remove screen')
                }

                // let deleteScreen = await Screens.update({ _id: screenId, tagId: tagId }, { $set: { screenStatus: 0 } });

                let deleteScreen = await Screens.update({ _id: screenId, tagId: tagId }, { $unset: { tagId: 1 } });


                let TagDetails = await ProjectTag.aggregate([
                    { $match: { _id: tagId, status: 1 } },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'tagId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            tagName: { $first: '$tagName' },
                            description: { $first: '$description' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email',
                                    userName: '$users.userName'
                                }
                            },
                            screens: {
                                $addToSet: {
                                    _id: '$screens._id',
                                    screenName: '$screens.screenName',
                                    image: '$screens.image',
                                    status: '$screens.screenStatus'
                                }
                            }
                        }
                    }
                ])
                return Response.success(res, TagDetails, 'Screen Deleted Successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        deleteTag: async (req, res) => {
            try {
                let tagId = req.body.tagId;

                let checkTag = await ProjectTag.findOne({ _id: tagId, createdUser: req.user._id, status: 1 });
                if (!checkTag) {
                    return Response.badValues(res, 'You are not have permission to delete this tag')
                }

                await ProjectTag.update({ _id: tagId }, { $set: { status: 0 } });

                return Response.success(res, 'Tag deleted successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        editTag: async (req, res) => {
            try {
                let tagId = req.body.tagId;
                let tagName = req.body.tagName;
                let description = req.body.description;

                let checkTag = await ProjectTag.findOne({ _id: tagId, createdUser: req.user._id, status: 1 });
                if (!checkTag) {
                    return Response.badValues(res, 'You are not have permission to delete this tag')
                }

                obj = {
                    tagName: tagName,
                    description: description
                }
                await ProjectTag.update({ _id: tagId }, { $set: obj })

                let TagDetails = await ProjectTag.aggregate([
                    { $match: { _id: tagId, status: 1 } },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'tagId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            tagName: { $first: '$tagName' },
                            description: { $first: '$description' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email',
                                    userName: '$users.userName'
                                }
                            },
                            screens: {
                                $addToSet: {
                                    _id: '$screens._id',
                                    screenName: '$screens.screenName',
                                    image: '$screens.image',
                                    status: '$screens.screenStatus'
                                }
                            }
                        }
                    }
                ])

                return Response.success(res, TagDetails, 'Tag updated successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        listTag: async (req, res) => {
            try {
                let listTag = await ProjectTag.aggregate([
                    { $match: { createdUser: req.user._id, status: 1 } },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'tagId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            tagName: { $first: '$tagName' },
                            description: { $first: '$description' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email',
                                    userName: '$users.userName'
                                }
                            },
                            screens: {
                                $addToSet: {
                                    _id: '$screens._id',
                                    screenName: '$screens.screenName',
                                    image: '$screens.image',
                                    status: '$screens.screenStatus'
                                }
                            }
                        }
                    }
                ])

                return Response.success(res, listTag, 'Tag List')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = projectTag()