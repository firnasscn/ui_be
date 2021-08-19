const Joi = require('joi');
const Screens = require('../screens/screens.model');
const Category = require('./categories.model');
const ScreenType = require('./screenTypes.model');
const Ratings = require('../ratings/ratings.model');
const Comments = require('../comments/comments.model');
const esClient = require('../../elasticsearch/client');
const Industry = require('../industry/industry.model')
const userSearch = require('../searchList/searchList.model');
const ScreenRating = require('../screenRatings/screenRatings.model');
const ObjectId = require('mongoose').Types.ObjectId;
const jwt = require('jsonwebtoken')
const mailer = require('../../utils/mailService')
    // const Occupation = require('../occupation/occupation.model')
const User = require('../user/user.model')
const UserBadge = require('../../utils/userBadge');
const userBageAnalysis = require('../userBadgeAnalysis/userBadgeAnalysis.model')
const badgeProperties = require('../badgeProperties/badgeProperties.model');
const Subscribers = require('../Subscribers/subscribers.modal')
const _ = require('lodash')
const Response = require('../../utils/response');
const Project = require('../project/project.model')
const FocusGroup = require('../focusGroup/focusGroup.model');
const ABTesting = require('../ABTesting/abTesting.model')
const moment = require('moment')


// const { Client } = require('@elastic/elasticsearch')
// const client = new Client({ node: 'http://localhost:9200' })

let lIntDataPerPage = 30;

function search(searchQuery, type) {
    return Screens.aggregate([{
            $match: {
                $and: [
                    { 'isPublish': true },
                    { 'approvedStatus': 'approved' },
                    { 'type': type }
                ]
            }
        },
        { $group: { _id: '$_id' } },
        {
            $lookup: {
                from: 'screens',
                localField: '_id',
                foreignField: '_id',
                as: 'data'
            }
        },
        { $unwind: '$data' },
        { $unwind: '$data.categories' },
        {
            $lookup: {
                from: 'categories',
                localField: 'data.categories',
                foreignField: '_id',
                as: 'data.categories'
            }
        },
        { $unwind: '$data.categories' },
        {
            $lookup: {
                from: 'screentypes',
                localField: 'data.screenType',
                foreignField: '_id',
                as: 'data.screenType'
            }
        },
        { $unwind: '$data.screenType' },
        {
            $match: {
                $or: [
                    { 'data.categories.name': { $regex: searchQuery, $options: 'gi' } },
                    { 'data.screenType.type': { $regex: searchQuery, $options: 'gi' } },
                    { 'data.screenName': { $regex: searchQuery, $options: 'gi' } }
                ]
            }
        },
        { $group: { _id: '$data._id' } },
        {
            $lookup: {
                from: 'screens',
                localField: '_id',
                foreignField: '_id',
                as: 'data'
            }
        },
        { $project: { data: 1, _id: 0 } },
        { $unwind: '$data' },
        {
            $lookup: {
                from: 'screentypes',
                localField: 'data.screenType',
                foreignField: '_id',
                as: 'data.screenType'
            }
        },
        { $unwind: '$data.screenType' },
        {
            $lookup: {
                from: 'categories',
                localField: 'data.categories',
                foreignField: '_id',
                as: 'data.categories'
            }
        },
        {
            $lookup: {
                from: 'users',
                let: { 'users': '$data.userId' },
                pipeline: [
                    { $match: { "$expr": { "$eq": ["$_id", "$$users"] } } },
                    { $project: { 'email': 1, 'userName': 1, '_id': 0 } }
                ],
                as: 'data.users'
            }
        },
        { $unwind: '$data.users' }
    ]);
}

function categoriesComponentCtrl(model) {
    const methods = {

        createOccupation: async(req, res) => {
            try {
                let occupation = req.body.occupation;
                let create = await Occupation.create({ occupation: occupation });
                return Response.success(res, create, 'Successfully Occupation Created');
            } catch (err) {
                console.log(err)
                return Response.errorInternal(err, res)
            }
        },

        getAllOccupations: async(req, res) => {
            try {
                let occupations = await Occupation.find({ status: 1 });
                let lObjResData;
                let occupation = [];
                for (let o of occupations) {
                    occupation.push({
                        _id: o._id,
                        Occupation: o.occupation
                    })
                }
                lObjResData = occupation
                return Response.success(res, lObjResData, 'Occupations List')
            } catch (e) {
                console.log(e);
                return Response.errorInternal(e, res)
            }
        },

        getAllCategories: async(req, res) => {
            try {
                // console.log(Categories)
                let lAryGetAllData = await Category.find().lean();
                return Response.success(res, lAryGetAllData, 'Categories List');
            } catch (e) {
                console.log(e)
                return Response.errorInternal(e, res)
            }
        },

        getAllScreenTypes: async(req, res) => {
            try {
                let lAryGetAllScreenTypes = await ScreenType.find().lean();
                return Response.success(res, lAryGetAllScreenTypes, 'ScreenType List');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        searchList: async(req, res) => {
            console.log('start')
            try {
                let page = Number(req.body.page);
                let from = page == 1 ? 0 : (Number(page - 1) * 30);
                let to = page == 1 ? Number(page * 30) : Number((page) * 30);
                let searchQuery = req.body.search ? req.body.search : ''
                let screenType = req.body.screenType ? req.body.screenType : ''
                let industryId = req.body.industryId ? req.body.industryId : ''
                let querySearch;

                //  //Joi Input validation
                //  const schema = Joi.object().keys({
                //   search: Joi.string().trim().required(),
                //   // industryId: Joi.array().items(Joi.string()),
                //   screenType: Joi.array().items(Joi.string()),
                //   page: Joi.number().required()
                // }).required()

                // let { error, value } = Joi.validate(req.body, schema);
                // if (error) {
                //   let lAryErrorMsg = _.map(error.details, "message")
                //   return Response.badValuesData(res, lAryErrorMsg);
                // }

                if (screenType != '' && industryId == '') {

                    querySearch = {
                        bool: {
                            must: [{
                                terms: {
                                    "screenType._id": screenType
                                }
                            }],
                            must: {
                                term: {
                                    "isPublish": true
                                }
                            }
                        }
                    }
                } else if (industryId != '' && screenType == '') {

                    querySearch = {
                        bool: {
                            must: [{
                                terms: {
                                    "projectId.industry": industryId
                                }
                            }],
                            should: {
                                term: {
                                    "isPublish": true
                                }
                            }
                        }
                    }

                } else if (industryId != '' && screenType != '') {

                    querySearch = {
                        bool: {
                            must: [{
                                terms: {
                                    "projectId.industry": industryId
                                }
                            }],
                            should: {
                                term: {
                                    "isPublish": true
                                }
                            },
                            should: {
                                terms: {
                                    "screenType._id": screenType
                                }
                            }
                        }
                    }
                } else if (industryId == '' && screenType == '') {
                    querySearch = {
                        term: {
                            "isPublish": true
                        }
                    }
                }

                esClient.search({
                    index: 'screenss',
                    type: 'screens',
                    body: {
                        query: {
                            bool: {
                                must: [{
                                        query_string: {
                                            fields: ["screenName", "projectId.projectName", "tags.name"],
                                            query: "" + searchQuery + "*"
                                        }
                                    },
                                    { "exists": { "field": "projectId" } },
                                    { "exists": { "field": "screenName" } }
                                ],
                                filter: querySearch
                            }
                        },
                        size: 30,
                        from: 0
                    }
                }, async function(err, results) {
                    if (err) {
                        console.log(err);
                        //return Response.badValuesData(err, res);
                    } else {
                        let resul = results.hits.hits
                            // console.log(resul)
                            // let saveUserSearch = await userSearch.create({userId : req.user._id, searchName : searchQuery});
                        for (let x of resul) {

                            if (!x._source.screenId) {
                                x._source.screenId = x._id
                            }
                            x._source.images = (x._source.type === 'mobile') ? `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${x._source.image}` : `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x480/screens/${x._source.image}`;
                            // if(x._source.userId.profilePicture != null) {
                            //   x._source.userId.profilePicture = (x._source.userId.profilePicture != null) ? `https://d31qgkthzchm5g.cloudfront.net/profilePicture/${x._source.userId.profilePicture}` : '';
                            // }

                        }
                        var screenname = [],
                            project = [],
                            tags = [],
                            filter = [];
                        resul.filter(function(res) {
                            let key = searchQuery.toLowerCase();
                            if (res._source.screenName.toLowerCase().search(key) >= 0) {
                                screenname.push(res);
                            } else if (res._source.projectId.projectName.toLowerCase().search(key) >= 0) {
                                project.push(res);
                            } else {
                                tags.push(res);
                            }
                        })
                        filter = screenname.concat(project, tags);
                        return Response.success(res, filter, 'Search Result');
                    }
                });
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        searchM: async(req, res) => {
            try {
                let searchQuery = req.body.search,
                    type = (!!req.body.type) ? req.body.type : "mobile";

                //Pagination
                let page = req.body.page;
                let skipRec = page - 1;
                skipRec = skipRec * lIntDataPerPage;

                let data = {};

                data['count'] = await search(searchQuery, type);
                data['count'] = data['count'].length;
                data['screens'] = await search(searchQuery, type).skip(skipRec).limit(lIntDataPerPage);

                return Response.success(res, data, 'Screens List');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        dashBoardScreens: async(req, res) => {
            try {
                let lStrType = (!!req.body.type) ? req.body.type : "mobile";
                let lObjQueryConditions = {
                    isPublish: true,
                    parentScreen: { $exists: false },
                    focusGroupId: { $exists: false },
                    approvedStatus: "approved",
                    type: lStrType,
                    screenStatus: { $ne: 0 }
                }
                let lObjResData = {
                    'screens': {}
                }

                lObjResData["screens"] = await Screens.find(lObjQueryConditions).sort({ 'viewCount': -1 }).limit(12);
                let screen = [];
                for (x of lObjResData.screens) {
                    let image = `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${x.image}`;
                    x.image = image;
                    screen.push({
                        _id: x._id,
                        images: x.image,
                        screenName: x.screenName
                    })
                }
                return Response.success(res, screen, 'Screens List');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        landingPageScreens: async(req, res) => {
            console.log('landing page')
            try {
                let lStrType = (!!req.body.type) ? req.body.type : "mobile";
                let lAryindustry = req.body.industry;
                let lObjScreenType = req.body.screenType;
                let lAryTags = req.body.tags;
                //check user is logged in or not
                if (req.headers['x-access-token']) {
                    let token = req.headers['x-access-token']
                    const decoded = await jwt.verify(token, process.env.SUPER_SECRET);
                    let userData = await User.findOne({ _id: decoded._id, email: decoded.email, userName: decoded.userName, lastLoggedIn: decoded.lastLoggedIn }).lean();
                    if (userData) {
                        req.user = userData;
                    }
                }
                //Joi Input validation
                const schema = Joi.object().keys({
                    industry: Joi.array().items(Joi.string()),
                    categories: Joi.array().items(Joi.string()),
                    screenType: Joi.array().items(Joi.string()),
                    tags: Joi.array().items(Joi.string()),
                    type: Joi.string().trim(),
                    page: Joi.number(),
                    search: Joi.string()
                }).required()

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjQueryConditions = {
                    screenName: { $regex: '', $options: 'i' },
                    isPublish: true,
                    parentScreen: { $exists: false },
                    focusGroupId: { $exists: false },
                    approvedStatus: "approved",
                    type: lStrType,
                    screenStatus: { $ne: 0 }
                }
                console.log(lObjQueryConditions, 'condition')
                if (!!lAryindustry && lAryindustry.length > 0) {
                    lObjQueryConditions['industry'] = {
                        $in: lAryindustry
                    }
                }
                if (!!lAryTags && lAryTags.length > 0) {
                    lObjQueryConditions['tags'] = {
                        $in: lAryTags
                    }
                }
                if (!!lObjScreenType && lObjScreenType.length > 0) {
                    lObjQueryConditions['screenType'] = { $in: lObjScreenType }
                }
                let page = req.body.page;
                if (!req.user && page == 4) {
                    return Response.noAccess(res, 'Limited results for non loged in user!!')
                }
                //Pagination

                let skipRec = page - 1;
                skipRec = skipRec * lIntDataPerPage;
                let lObjResData = {
                    'screens': {},
                    'totalCount': await Screens.find(lObjQueryConditions).count()
                }

                lObjResData['screens'] = await Screens.find(
                        lObjQueryConditions
                    ).populate('screenType', '_id type')
                    .populate('userId', '_id email userName firstName lastName profilePicture')
                    .populate('industry', '_id name')
                    .populate('projectId', '_id projectName')
                    .populate('tags', '_id name')
                    .sort({ 'viewCount': -1 })
                    .skip(skipRec)
                    .limit(lIntDataPerPage).lean();

                for (let x of lObjResData.screens) {
                    x.originalImage = `https://d31qgkthzchm5g.cloudfront.net/screens/${x.image}`
                    x.images = (x.type === 'mobile') ? `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${x.image}` : `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x480/screens/${x.image}`;
                }
                if (req.body.search && (req.body.search != "")) {
                    let searchQuery = req.body.search,
                        type = (!!req.body.type) ? req.body.type : "mobile";

                    //Pagination
                    let page = req.body.page;
                    let skipRec = page - 1;
                    skipRec = skipRec * lIntDataPerPage;
                    let lObjResData = {

                    }
                    let data = {};

                    data['count'] = await search(searchQuery, type);
                    lObjResData['totalCount'] = data['count'].length;
                    let screens = await (search(searchQuery, type).skip(skipRec).limit(lIntDataPerPage));
                    let screenData = [];
                    for (let screen of screens) {
                        screen.data.originalImage = `https://d31qgkthzchm5g.cloudfront.net/screens/${screen.data.image}`;
                        screen.data.images = (screen.data.type === 'mobile') ? `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${screen.data.image}` : `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x480/screens/${screen.data.image}`
                        screenData.push(screen.data)
                    }
                    lObjResData['screens'] = await screenData
                    return Response.success(res, lObjResData, 'Screens List');
                } else {
                    return Response.success(res, lObjResData, 'Screens List');
                }

            } catch (e) {
                console.log(e);
                return Response.errorInternal(e, res)
            }
        },
        screenDetail: async(req, res) => {
            try {

                let lObjScreenId = req.params.screenId;
                let lObjScreen = await Screens.find({ _id: lObjScreenId })
                    .populate('userId', '_id firstName lastName userName').
                populate('screenType', '_id type').populate('industry', '_id name').
                populate('tags', '_id name')
                    // .populate([{
                    //         path: "projectId",
                    //         select: "_id projectName",
                    //         populate: [{ path: 'fonts', select: '_id name' }, { path: 'tools', select: '_id name icon' }]
                    //     }])
                    .lean();

                if (lObjScreen === null || lObjScreen.length == 0) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    if (req.headers['x-access-token']) {
                        const decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET);
                        let userData = await User.findOne({ _id: decoded._id, email: decoded.email, userName: decoded.userName, lastLoggedIn: decoded.lastLoggedIn }).lean();
                        if (userData) {
                            req.user = userData;
                            UserBadge.screenViewTracking(req.user._id, 'screenViewed')
                        }
                    }
                    let viewCount = lObjScreen[0].viewCount ? lObjScreen[0].viewCount : 0
                    await Screens.update({ _id: ObjectId(lObjScreenId) }, { $set: { viewCount: viewCount + 1 } }, { new: true }).lean()
                    for (let x of lObjScreen) {
                        x.originalImage = `https://d31qgkthzchm5g.cloudfront.net/screens/${x.image}`
                        x.images = `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x800/screens/${x.image}`
                        x.viewCount = viewCount + 1
                    }
                    lObjScreen = lObjScreen ? lObjScreen.slice()[0] : {}
                    lObjScreen['overAllRating'] = await ScreenRating.aggregate([
                        { $match: { "screenId": ObjectId(req.params.screenId) } },
                        { $lookup: { from: 'screenratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $unwind: '$ratingTypeId' },
                        {
                            $group: {
                                _id: { "screenId": "$screenId", "userId": "$userId._id", 'ratingId': '$ratingTypeId._id' },
                                "ratings": {
                                    "$push": {
                                        'ratingType': '$ratingTypeId.name',
                                        'icon': '$ratingTypeId.icon',
                                        'prependText': '$ratingTypeId.prependText',
                                        'ratingId': '$ratingTypeId._id',
                                        'vote': '$vote'
                                    }
                                }
                            }
                        },
                        { $unwind: '$ratings' },
                        {
                            $group: {
                                _id: '$_id.ratingId',
                                "ratingType": { $first: "$ratings.ratingType" },
                                'icon': { $first: '$ratings.icon' },
                                'prependText': { $first: '$ratings.prependText' },
                                'ratingId': { $first: '$ratings.ratingId' },
                                "vote": {
                                    $sum: {
                                        "$sum": "$ratings.vote"
                                    }
                                }
                            }
                        }
                    ])

                    let lObjQueryConditions = {
                        isPublish: true,
                        parentScreen: { $exists: false },
                        focusGroupId: { $exists: false },
                        approvedStatus: "approved",
                        type: 'mobile',
                        screenStatus: { $ne: 0 },
                        // tags: { $in: [ObjectId(lObjScreen.tags[0]._id)]}
                    }

                    let sampleImages = await Screens.find(
                            lObjQueryConditions
                        ).populate('screenType', '_id type')
                        .populate('userId', '_id email userName firstName lastName profilePicture')
                        .populate('industry', '_id name')
                        .populate('projectId', '_id projectName')
                        .populate('tags', '_id name')
                        .limit(4).lean();

                    for (let image of sampleImages) {
                        let i = `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${image.image}`;
                        image.image = i;
                        image['images'] = i;
                    }
                    await sampleImages.splice(0, 1)

                    lObjScreen['similarScreens'] = await sampleImages;
                    lObjScreen['screenUsed'] = await Screens.count({ projectId: { $exists: true }, parentScreen: ObjectId(req.params.screenId) })
                    return Response.success(res, lObjScreen, "Screen Details")
                }
            } catch (error) {
                console.log(error);
                return Response.errorInternal(error, res)
            }

        },
        projectScreenDetail: async(req, res) => {
            try {

                let lObjScreenId = req.params.screenId;
                let lObjScreen = await Screens.find({ _id: lObjScreenId }).populate('userId', '_id firstName lastName userName').
                populate('screenType', '_id type').populate('industry', '_id name').
                populate('tags', '_id name').populate([{
                        path: "projectId",
                        select: "_id projectName",
                        populate: [{ path: 'fonts', select: '_id name' }, { path: 'tools', select: '_id name icon' }]
                    }])
                    .lean()
                if (lObjScreen === null || lObjScreen.length == 0) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    if (req.headers['x-access-token']) {
                        const decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET);
                        let userData = await User.findOne({ _id: decoded._id, email: decoded.email, userName: decoded.userName, lastLoggedIn: decoded.lastLoggedIn }).lean();
                        if (userData) {
                            req.user = userData;
                            UserBadge.screenViewTracking(req.user._id, 'screenViewed')
                        }
                    }
                    let viewCount = lObjScreen[0].viewCount ? lObjScreen[0].viewCount : 0
                    await Screens.update({ _id: ObjectId(lObjScreenId) }, { $set: { viewCount: viewCount + 1 } }, { new: true }).lean()
                    for (let x of lObjScreen) {
                        x.originalImage = `${process.env.AWS_URL}${x.image}`
                        x.images = `${process.env.AWS_URL}${x.image}`
                        x.viewCount = viewCount + 1
                    }
                    lObjScreen = lObjScreen ? lObjScreen.slice()[0] : {}
                    lObjScreen['overAllRating'] = await ScreenRating.aggregate([
                        { $match: { "screenId": ObjectId(req.params.screenId) } },
                        { $lookup: { from: 'screenratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $unwind: '$ratingTypeId' },
                        {
                            $group: {
                                _id: { "screenId": "$screenId", "userId": "$userId._id", 'ratingId': '$ratingTypeId._id' },
                                "ratings": {
                                    "$push": {
                                        'ratingType': '$ratingTypeId.name',
                                        'icon': '$ratingTypeId.icon',
                                        'prependText': '$ratingTypeId.prependText',
                                        'ratingId': '$ratingTypeId._id',
                                        'vote': '$vote'
                                    }
                                }
                            }
                        },
                        { $unwind: '$ratings' },
                        {
                            $group: {
                                _id: '$_id.ratingId',
                                "ratingType": { $first: "$ratings.ratingType" },
                                'icon': { $first: '$ratings.icon' },
                                'prependText': { $first: '$ratings.prependText' },
                                'ratingId': { $first: '$ratings.ratingId' },
                                "vote": {
                                    $sum: {
                                        "$sum": "$ratings.vote"
                                    }
                                }
                            }
                        }
                    ])

                    let lObjQueryConditions = {
                        isPublish: true,
                        parentScreen: { $exists: false },
                        focusGroupId: { $exists: false },
                        approvedStatus: "approved",
                        type: 'mobile',
                        screenStatus: { $ne: 0 },
                        // tags: { $in: [ObjectId(lObjScreen.tags[0]._id)]}
                    }

                    let sampleImages = await Screens.find(
                            lObjQueryConditions
                        ).populate('screenType', '_id type')
                        .populate('userId', '_id email userName firstName lastName profilePicture')
                        .populate('industry', '_id name')
                        .populate('projectId', '_id projectName')
                        .populate('tags', '_id name')
                        .limit(4).lean();

                    for (let image of sampleImages) {
                        let i = `${process.env.AWS_URL}${image.image}`;
                        image.image = i;
                        image['images'] = i;
                    }
                    await sampleImages.splice(0, 1)

                    lObjScreen['similarScreens'] = await sampleImages;
                    lObjScreen['screenUsed'] = await Screens.count({ projectId: { $exists: true }, parentScreen: ObjectId(req.params.screenId) })
                    return Response.success(res, lObjScreen, "Screen Details")
                }
            } catch (error) {
                console.log(error);
                return Response.errorInternal(error, res)
            }

        },
        listAllComments: async(req, res) => {
            try {
                let lObjScreenId = req.params.screenId;
                let lObjComment = await Comments.aggregate([{ $match: { screenId: ObjectId(lObjScreenId), parentId: { $exists: false } } },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    { $lookup: { from: 'comments', localField: '_id', foreignField: 'parentId', as: 'comment' } },
                    {
                        $group: {
                            _id: "$_id",
                            screenId: { $first: "$screenId" },
                            updated_at: { $first: "$updated_at" },
                            comments: { $first: "$comments" },
                            status: { $first: "$status" },
                            comment: { $first: "$comment" },
                            "createdUser": { $first: "$createdUser" },
                        }
                    },
                    {
                        $project: {
                            _id: "$_id",
                            updated_at: 1,
                            "status": 1,
                            "comments": 1,
                            "screenId": 1,
                            "comment": 1,
                            "userId": {
                                '_id': '$createdUser._id',
                                'userName': '$createdUser.userName',
                                'firstName': '$createdUser.firstName',
                                'lastName': '$createdUser.lastName',
                                'email': '$createdUser.email',
                                "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
                            }
                        }
                    },
                    { $unwind: { path: "$comment", 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            screenId: { $first: "$screenId" },
                            updated_at: { $first: "$updated_at" },
                            comments: { $first: "$comments" },
                            status: { $first: "$status" },
                            'userId': { $first: "$userId" },
                            comment: {
                                $push: {
                                    _id: "$comment._id",
                                    screenId: "$comment.screenId",
                                    'comment': "$comment.comments",
                                    'userId': "$comment.userId",
                                }
                            },
                        }
                    },
                    { $unwind: { path: "$comment", 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'comment.userId', foreignField: '_id', as: 'comment.userId' } },
                    { $unwind: { path: "$comment.userId", 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            screenId: { $first: "$screenId" },
                            updated_at: { $first: "$updated_at" },
                            comment: { $first: "$comments" },
                            status: { $first: "$status" },
                            'userId': { $first: "$userId" },
                            replies: {
                                $push: {
                                    "_id": "$comment._id",
                                    screenId: "$comment.screenId",
                                    'comment': "$comment.comment",
                                    userId: {
                                        userName: "$comment.userId.userName",
                                        firstName: "$comment.userId.firstName",
                                        lastName: "$comment.userId.lastName",
                                        email: "$comment.userId.email",
                                        _id: "$comment.userId._id"
                                    }
                                }
                            }
                        }
                    },
                ]).sort({ updated_at: -1 })
                for (let comment of lObjComment) {
                    if (comment.replies) {
                        comment.replies = _.filter(comment.replies, function(v) {
                            let vi = _.filter(v.userId, function(x) {
                                if (Object.keys(x).length) {
                                    return x;
                                }
                            })
                            if (vi.length > 0)
                                return vi;

                        });
                    }

                    let lObjRating = await ScreenRating.aggregate([
                        { $match: { "screenId": ObjectId(req.params.screenId), "commentId": ObjectId(comment._id) } },
                        { $lookup: { from: 'screenratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $unwind: '$ratingTypeId' },
                        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                        { $unwind: '$userId' },
                        { $lookup: { from: 'screentags', localField: 'comment', foreignField: '_id', as: 'tags' } },
                        { $unwind: '$tags' },
                        {
                            $group: {
                                _id: { "screenId": "$screenId", "userId": "$userId._id" },
                                'ratingTypeId': { $first: '$ratingTypeId' },
                                "commentText": {
                                    "$push": {
                                        'name': '$tags.name'
                                    }
                                },
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                "ratings": {
                                    "$push": {
                                        'ratingType': '$ratingTypeId.name',
                                        'icon': '$ratingTypeId.icon',
                                        'prependText': '$ratingTypeId.prependText',
                                        'ratingId': '$ratingTypeId._id',
                                        'tags': '$commentText',
                                        'vote': '$vote'
                                    }
                                },
                            }
                        },
                        { $unwind: '$ratings' },
                        {
                            $project: {
                                _id: 0,
                                "ratings": {
                                    'ratingType': '$ratings.ratingType',
                                    'icon': '$ratings.icon',
                                    'prependText': '$ratings.prependText',
                                    'ratingId': '$ratings.ratingId',
                                    'tags': '$ratings.tags'
                                },
                            }
                        }
                    ])
                    comment["rating"] = lObjRating.length > 0 ? lObjRating[0].ratings : {}
                }
                return Response.success(res, lObjComment, "Feedbacks in screen")
            } catch (error) {
                return Response.errorInternal(error, res)

            }
        },
        popular: async(req, res) => {
            try {
                let tag = req.query.type;
                let sort = {};
                if (tag == "popular")
                    sort = { 'data.views': -1, rating: -1, _id: -1 };
                else if (tag == "mostrated")
                    sort = { rating: -1, _id: -1 };
                else
                    sort = { _id: -1 };

                let type = (!!req.body.type) ? req.body.type : "mobile";
                let popularScreens = await Screens.aggregate([{
                        $match: {
                            $and: [
                                { 'isPublish': true },
                                { 'approvedStatus': 'approved' },
                                { 'type': type }
                            ]
                        }
                    },
                    {
                        $group: {
                            _id: '$_id',
                            rating: { $sum: { $sum: ['$avgRating.aesthetics', '$avgRating.designThinking', '$avgRating.easeOfUse'] } }
                        }
                    },
                    { $project: { rating: 1 } },
                    {
                        $lookup: {
                            from: 'screens',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'data'
                        }
                    },
                    { $project: { data: 1, _id: 0, rating: 1 } },
                    { $unwind: '$data' },
                    {
                        $lookup: {
                            from: 'screentypes',
                            localField: 'data.screenType',
                            foreignField: '_id',
                            as: 'data.screenType'
                        }
                    },
                    { $unwind: '$data.screenType' },
                    {
                        $lookup: {
                            from: 'categories',
                            localField: 'data.categories',
                            foreignField: '_id',
                            as: 'data.categories'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            let: { 'users': '$data.userId' },
                            pipeline: [
                                { $match: { "$expr": { "$eq": ["$_id", "$$users"] } } },
                                { $project: { 'email': 1, 'userName': 1, '_id': 0 } }
                            ],
                            as: 'data.users'
                        }
                    },
                    { $unwind: '$data.users' }
                ]).sort(sort);

                //Pagination
                let page = req.body.page;
                let skipRec = page - 1;
                skipRec = skipRec * lIntDataPerPage;

                let data = {
                    'totalCount': popularScreens.length,
                    'screens': popularScreens.slice(skipRec, skipRec + lIntDataPerPage)
                };

                return Response.success(res, data, 'Screens List');
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        },
        /**
         * Get all invited members under the login user
         */
        getAllInvitedmembers: async(req, res) => {
            try {
                let Email = [];
                let members = await UserInvite.find({ userId: req.user._id });
                members.filter(function(member) {
                    if (member) {
                        Email.push(member.email);
                    }
                })
                return Response.success(res, Email, 'All invited members');
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        },
        /**
         * Provide Badge to particular user for which BadgeProperties cross
         */
        compareBadgeProperties: async(req, res) => {
            try {
                let currentUserBadge = await userBageAnalysis.find({ userId: req.user._id })
                let updateuser;
                if (currentUserBadge) {
                    let allBadgeProperties = await badgeProperties.find();
                    let update = await allBadgeProperties.forEach(async function(badge) {
                        if ((Number(currentUserBadge[0].screensViewed) > Number(badge.screensViewed)) && (Number(currentUserBadge[0].screensCommented) > Number(badge.screensCommented)) && (Number(currentUserBadge[0].screensRated) > Number(badge.screensRated)) && (Number(currentUserBadge[0].screensPublished) > Number(badge.screensPublished)) && (Number(currentUserBadge[0].commentsReceived) > Number(badge.commentsReceived)) && (Number(currentUserBadge[0].ratingsReceived) > Number(badge.ratingsReceived)) && (Number(currentUserBadge[0].avgRatingReceived) > Number(badge.avgRatingsReceived)) && (Number(currentUserBadge[0].focusGroupParticipated) > Number(badge.FocusgroupsParticipated)) && (Number(currentUserBadge[0].ABTestingArticipated) > Number(badge.ABTestsParticipated))) {
                            updateuser = await {
                                message: 'update',
                                badgeId: badge.badgeId._id
                            };
                        } else {
                            updateuser = await {
                                message: 'nothing to update'
                            };
                        }
                    });

                    if (updateuser.message == 'update') {
                        let badgeupdate = await userBageAnalysis.updateOne({ userId: req.user._id }, { $set: { badgeId: updateuser.badgeId } });
                        return Response.success(res, badgeupdate, 'Badge Updated Successfully');
                    } else if (updateuser.message == 'nothing to update') {
                        return Response.message(res, 203, 'User did not match yet any badges');
                    }

                }

            } catch (error) {
                console.log(error);
                return Response.errorInternal(error, res);
            }
        },

        exportReport: async(req, res) => {
            try {
                let getAllScreenTypes = await ScreenType.find()
                let getAllIndustries = await Industry.find()
                let getAllScreens = await Screens.find({
                    isPublish: true,
                    parentScreen: { $exists: false },
                    focusGroupId: { $exists: false },
                    approvedStatus: "approved",
                    screenStatus: { $ne: 0 }
                });
                console.log('screen length ', getAllScreens.length)

                var fs = require('fs');
                const path = require('path')

                var jsn = []
                for (let industry of getAllIndustries) {
                    let loopingArray = []
                    for (let type of getAllScreenTypes) {
                        let count = await Screens.count({ isPublish: true, parentScreen: { $exists: false }, focusGroupId: { $exists: false }, approvedStatus: "approved", screenStatus: { $ne: 0 }, screenType: ObjectId(type._id), industry: ObjectId(industry._id) })
                        var jsonArray = {
                            "screenName": type.type,
                            "industryName": industry.name,
                            "count": count
                        }
                        loopingArray.push(jsonArray)

                    }
                    // console.log(loopingArray);return;
                    jsn = jsn.concat(loopingArray)
                }
                let finalResult = jsn.reduce(function(rv, x) {
                    (rv[x['industryName']] = rv[x['industryName']] || []).push(x);
                    return rv;
                }, {});

                let data = "Industry";
                for (let screenType of getAllScreenTypes) {
                    data = data + '\t' + screenType.type;
                }

                let rows = []
                for (let industry of getAllIndustries) {
                    let details = finalResult[industry.name]
                    let dummy = []
                    for (let count of details) {
                        let d = count.count

                        dummy.push(d)
                    }

                    rows.push({
                        industryName: industry.name,
                        columns: dummy
                    })

                }

                for (var i = 0; i < rows.length; i++) {
                    let col = ""
                    for (j = 0; j < rows[i].columns.length; j++) {
                        if (j == 0) {
                            col = col + rows[i].industryName + '\t'
                        }
                        col = col + rows[i].columns[j] + '\t';
                    }
                    data = data + '\n' + col
                }

                if (fs.existsSync(path.join(__dirname, `../../public/report.xlsx`))) {
                    fs.unlinkSync(path.join(__dirname, `../../public/report.xlsx`))
                }
                let promise = new Promise((resolve, reject) => {
                    fs.writeFile(path.join(__dirname, `../../public/report.xlsx`), data, (err) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve("File created")
                        }
                    });
                })
                await promise
                let filepath = { path: `${process.env.SERVER_URL}public/report.xlsx` };
                return Response.success(res, filepath, "Export link for the project");


            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        },
        userReport: async(req, res) => {
            try {
                var fs = require('fs');
                const path = require('path')
                let userDetails = await User.find().sort({ createdAt: -1 });
                for (let user of userDetails) {

                }

                if (userDetails.length > 0) {
                    var jsn = []

                    for (let user of userDetails) {

                        let focusGroup = await FocusGroup.find({ $or: [{ createdUser: user._id }, { joinedMembers: user._id }] }).count();
                        let abTesting = await ABTesting.find({ $or: [{ createdUser: user._id }, { joinedMembers: user._id }] }).count();
                        let date = moment(user.createdAt).format('DD MMM YYYY')
                        let lastLoggedIn = user.lastLoggedIn ? moment(user.lastLoggedIn).format('DD MMM YYYY') : '-'

                        var jsonArray = {
                            "name": user.firstName + user.lastName,
                            "userName": user.userName,
                            "email": user.email,
                            "createdAt": date,
                            "lastLoggedIn": lastLoggedIn,
                            "FocusGroupCount": focusGroup,
                            "ABTestingCount": abTesting
                        }
                        jsn.push(jsonArray)

                    }

                    var data = 'Sno.\tName\tUsername\tEmail\tCreated  on\tLast logged in\tFocus groups\tA/B Tests\n';
                    for (var i = 0; i < jsn.length; i++) {
                        data = data + (i + 1) + '\t' + jsn[i].userName + '\t' + jsn[i].userName + '\t' + jsn[i].email + '\t' + jsn[i].createdAt + '\t' + jsn[i].lastLoggedIn + '\t' + jsn[i].FocusGroupCount + '\t' + jsn[i].ABTestingCount + '\n';
                    }
                    if (fs.existsSync(path.join(__dirname, `../../public/userReport.xlsx`))) {
                        fs.unlinkSync(path.join(__dirname, `../../public/userReport.xlsx`))
                    }
                    let promise = new Promise((resolve, reject) => {
                        fs.writeFile(path.join(__dirname, `../../public/userReport.xlsx`), data, (err) => {
                            if (err) {
                                reject(err)
                            } else {
                                resolve("File created")
                            }
                        });
                    })
                    await promise
                    let filepath = { path: `${process.env.SERVER_URL}public/userReport.xlsx` };
                    return Response.success(res, filepath, "Export link for the project");
                } else {
                    return Response.success(res, "There is no screens for this project!!");
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        getUserProjects: async(req, res) => {
            try {
                let projectCount = await Project.find({ $or: [{ inviteMembers: req.user.email }, { userId: ObjectId(req.user._id) }] }).count()
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        getEmailFromLP: async(req, res) => {
            try {
                console.log('start')
                const schema = Joi.object().keys({
                    email: Joi.string().trim().regex(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).label('email').required()
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg[0]);
                }

                // let checkExists = await Subscribers.find({email: req.body.email});
                // if(checkExists.length > 0) {
                //   return Response.badValuesData(res, 'You are already in waiting list')
                // }

                let data = await Subscribers.create(req.body)
                let mailData = {
                    email: req.body.email
                }
                mailer.welcomeInvitation(mailData)
                Response.success(res, data, 'Thanks for subscribe')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        // db migration changes for inspire screens projects on 14/5/2020 by Firnaas

        dbMigrationChanges: async(req, res) => {
            try {
                console.log('start')

                // let inspire = await Screens.find({
                //     screenName: { $regex: '', $options: 'i' },
                //     isPublish: true,
                //     parentScreen: { $exists: false },
                //     focusGroupId: { $exists: false },
                //     approvedStatus: "approved",
                //     type: 'mobile',
                //     screenStatus: { $ne: 0 }
                // }).lean();

                let projects = await Project.find({}).select('_id');

                projects = projects.map(v => {
                    return v._id;
                })

                for (let x of projects) {
                    let data = await Screens.find({
                        screenName: { $regex: '', $options: 'i' },
                        isPublish: true,
                        parentScreen: { $exists: false },
                        focusGroupId: { $exists: false },
                        approvedStatus: "approved",
                        type: 'mobile',
                        screenStatus: { $ne: 0 },
                        projectId: x
                    }).lean();
                }

                // let removeProjectId = [],
                //     inspireProjectId = [];

                // for (let x of inspire) {
                //     for (let y of projects) {
                //         if (x.projectId.toString() === y.toString()) {
                //             inspireProjectId.push(x.projectId);
                //         } else {
                //             removeProjectId.push(y);
                //         }
                //     }
                // }

                // removeProjectId = [...removeProjectId]

                Response.success(res, {
                    count: projects.length,
                    projects,
                    // inspireProjectId
                }, 'Thanks for subscribe')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = categoriesComponentCtrl()