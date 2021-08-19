require("dotenv").config();

const Joi = require('joi');
const Response = require('../../utils/response');
const verify = require('../../utils/authenticate');
const mailer = require('../../utils/mailService');
const jwt = require("jsonwebtoken");
const _ = require('lodash');
const ABTesting = require('../ABTesting/abTesting.model');
const UserInvite = require('../userInvited/userInvite.model');
const ABQuestion = require('../testingQuestion/testingQuestion.model');
const User = require('../user/user.model');
const UserBadge = require('../../utils/userBadge');
const ABScreens = require('../testingScreens/testingScreens.model');
const Screens = require('../screens/screens.model');
const ABResponse = require('../testingResponse/testingResponse.model');
const pusherNotif = require('../../utils/pusher');
const notification = require('../notification/notification.model');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const sanitize = data => {
  //remove sensitive data
  for (let v of data.invitedMembers) {
    delete v.invitationToken;
  }
  data.__v = data.updatedAt = undefined;
  return data;
};
function abTestingComponentCtrl(model) {
  const methods = {
    /**
     * Create New AB Testing
     */
    createNewTesting: async (req, res) => {
      try {
        const schema = Joi.object().keys({
          testingName: Joi.string().trim().required(),
          description: Joi.string().trim().allow(''),
          type: Joi.string(),
        }).required().options({ abortEarly: false })

        let { error, value } = Joi.validate(req.body, schema);
        if (error) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }
        // let checkABCreation = await verify.checkLimit(req.user._id, 'AB', res);
        // if (checkABCreation) {
          value.createdUser = req.user._id;
          let lObjABTesting = await ABTesting.create(value)
          UserBadge.abTestingParticipated(req.user._id);
          return Response.success(res, lObjABTesting, `${req.body.testingName} created succesfully`);
        // } else {
        //   return Response.forbiddenError(res, 'You have crossed the limit for creating AB testing!!');
        // }
      } catch (e) {
        return Response.errorInternal(e, res)
      }
    },
    /**
    * Adding question to the testing group 
    * Input:(header token)
    */
    addQuestion: async (req, res) => { 
      try {

        if (!!req.fileValidationErr) {
          return Response.badValuesData(res, req.fileValidationErr);
        } else {
          const schema = Joi.object().keys({
            testingId: Joi.string().trim().required(),
            question: Joi.string().required(),
            screenIds: Joi.any()
          })

          let { error, value } = Joi.validate(req.body, schema);
          if (error) {
            let lAryErrorMsg = _.map(error.details, "message")
            return Response.badValuesData(res, lAryErrorMsg);
          }
          value.createdUser = req.user._id;
          let checkTesting = await ABTesting.find({ _id: ObjectId(req.body.testingId), createdUser: ObjectId(req.user._id), status: { $eq: 0 } })
          if (checkTesting == null) {
            return Response.forbiddenError(res, 'You do not have the permission to add questions to this A/B test!!')
          }
          let lObjABQuestion = await ABQuestion.create(value)
          let lAryScreenData = [];
          let lAryScreens = req.files;
          // Add screens from files
          for (let v of lAryScreens) {
            let lObjRes = await ABScreens.create({
              image: v.key,
              testingId: req.body.testingId,
              questionId: lObjABQuestion._id,
              createdUser: req.user._id,
            })
            lObjRes.images = `http://d39ci336oshgjr.cloudfront.net//screens/${lObjRes.image}`;
            lAryScreenData.push(lObjRes)
          }
          // Add screens from projects
          if (typeof (req.body.screenIds) == "string") {
            req.body.screenIds = req.body.screenIds.split(" ");
          }
          if (req.body.screenIds) {
            let lAryScreenData = [];
            for (let screen of req.body.screenIds) {
              let lObjScreenDetails = await Screens.find({ _id: screen }, { _id: 1, image: 1, projectId: 1 }).lean()
              if (lObjScreenDetails.length > 0) {
                let obj = {
                  image: lObjScreenDetails[0].image,
                  testingId: req.body.testingId,
                  questionId: lObjABQuestion._id,
                  createdUser: req.user._id,
                  parentProjectId: lObjScreenDetails[0].projectId,
                  parentScreenId: lObjScreenDetails[0]._id
                }
                lAryScreenData.push(obj)
              }
            }
            let lObjResScreen = await ABScreens.create(lAryScreenData)
            lObjResScreen.images = `http://d39ci336oshgjr.cloudfront.net//screens/${lObjResScreen.image}`;
            lAryScreenData.push(lObjResScreen)

          }
          return Response.success(res, lAryScreenData, 'Question added succesfully');
        }
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /**
    * List all testing group by the logged in user
    * Input:(header token)
    */
    listTesting: async (req, res) => {
      try {
       
        gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 15 : parseInt(req.query.offset)

        //Pagination
        let page = req.query.page || 1;
        let skipRec = page - 1;
        skipRec = skipRec * gIntDataPerPage;

        let limit = Number(req.query.limit);
        let pageLimit;
        if(limit) {
          pageLimit = limit;
        } else {
          pageLimit = gIntDataPerPage;
        }

        console.log('pageLimit ', pageLimit)

        let lAryQueryCondition
        if (req.query.type == 'all') {
          lAryQueryCondition = {
            $or: [
              { "joinedMembers": ObjectId(req.user._id) },
              { "createdUser": ObjectId(req.user._id) },
            ]
          };
        } else if (req.query.type == 'own') {
          lAryQueryCondition = {
            $or:
              [
                { "createdUser": ObjectId(req.user._id) }
              ]
          }
        } else {
          lAryQueryCondition = {
            $and: [
              { "createdUser": ObjectId(req.query.type) },
              { "joinedMembers": ObjectId(req.user._id) }
            ]
          };
        }
        console.log(lAryQueryCondition)
        let queryParam = ''
        if (req.query.query) {
          queryParam = req.query.query
        }
        var status;
        if (req.query.status == 4) {
          status = {
            status : { $eq : 4}
          }
        } else  {
          status = {
            status : { $nin : [3,4] }
          }
        }
        let lIntNoOfGroups = await ABTesting.count({
          $and: [
            lAryQueryCondition
          ]
        })
        if (req.query.sort == "asc") {
          var dateParam = { createdAt: -1 }
        } else {
          var dateParam = { createdAt: 1 }
        }
        let lObjTestingList = await ABTesting.aggregate([
          {
            $match: {
              $and: [
                lAryQueryCondition
              ]
            }
          },
          { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
          { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
          { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
          { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
          {
            $group: {
              "_id": "$_id",
              "testingName": { $first: "$testingName" },
              "createdAt": { $first: "$createdAt" },
              "type": { $first: "$type" },
              "createdUser": { $first: "$createdUser" },
              "joinedMembers": {
                "$push": {
                  '_id': '$joinedMembers._id',
                  'userName': '$joinedMembers.userName',
                  'firstName': '$joinedMembers.firstName',
                  'lastName': '$joinedMembers.lastName',
                  'email': '$joinedMembers.email',
                  "profilePicture": { $ifNull: [{ $concat: ["http://d39ci336oshgjr.cloudfront.net//profilePicture/", "$joinedMembers.profilePicture"] }, ""] }
                }
              },
              "status": { $first: "$status" },
              "response": { $first: "$response" },
            }
          },
          
          { $unwind: '$createdUser' },

          {
            $project: {
              "_id": 1,
              "testingName": 1,
              "createdAt": 1,
              "type": 1,
              "joinedMembers": 1,
              "status": 1,
              "response": 1,
              "createdUser": {
                '_id': '$createdUser._id',
                'userName': '$createdUser.userName',
                'email': '$createdUser.email',
                'firstName': '$createdUser.firstName',
                'lastName': '$createdUser.lastName'
              },
            }
          },
          { $match: { "testingName": { $regex: queryParam, "$options": "i" } } },
          { $match: status },
          { $sort: dateParam },
          { $skip: skipRec },
          { $limit: pageLimit }
        ])
        if (lObjTestingList.length > 0) {
          for (let objTesting of lObjTestingList) {
            objTesting.joinedMembers = _.filter(objTesting.joinedMembers, function (v) {
              return v.profilePicture;
            });
            let lObjCheckAlreadyresponded = await ABResponse.findOne({ testingId: objTesting._id, createdUser: req.user._id })
            if (lObjCheckAlreadyresponded) {
              objTesting.responseStatus = true
            } else {
              objTesting.responseStatus = false
            }
          }

        }
        return Response.success(res, lObjTestingList, "AB Testing loaded successfully!!")
      } catch (error) {
        console.log(error)
        return Response.errorInternal(error, res)
      }
    },

    /**
     * Collaborators list for AB testing
     */
    collaboratorsList: async (req, res) => {
      try {
        let lObjRes = await ABTesting.aggregate([{
          $match: {
            "joinedMembers": ObjectId(req.user._id), status: { $ne: 0 }
          }
        },
        { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
        { $unwind: '$createdUser' },
        {
          $project: {
            _id: 1,
            createdUser: {
              '_id': '$createdUser._id',
              'userName': '$createdUser.userName',
              'email': '$createdUser.email',
              'firstName': '$createdUser.firstName',
              'lastName': '$createdUser.lastName',
              'profilePicture': { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
            }

          }
        },
        ])
        let finalArray = []
        for (let result of lObjRes) {
          let createdUserList = result.createdUser
          finalArray.push(createdUserList)
        }
        let finalArrayRes = _.uniqBy(finalArray, 'userName');
        return Response.success(res, finalArrayRes, 'AB Testing Collaborators list Loaded succesfully');
      } catch (error) {
        console.log(error)
        return Response.errorInternal(error, res)
      }
    },
    /**
    * Add comments to the question by the joined members and created user
    * Input:(header token)
    */
    postComment: async (req, res) => {
      try {
        const schema = Joi.object().keys({
          questionId: Joi.string().trim(),
          comment: Joi.string()
        }).required().options({ abortEarly: false })

        let { error, value } = Joi.validate(req.body, schema);
        if (error) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }
        let comments = {
          comment: value.comment,
          userId: req.user._id
        }
        let lObABQuestion = await ABQuestion.findOneAndUpdate({ _id: req.body.questionId }, { $push: { comments: comments } },
          { new: true }).lean()

        return Response.success(res, lObABQuestion, 'Projects updated succesfully');
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /**
    * Publish the saved testing group 
    * Input:(header token)
    */
    publishTesting: async (req, res) => {
      try {
        const schema = Joi.object().keys({
          testingId: Joi.string().trim().required(),
          status: Joi.number().required()
        }).required().options({ abortEarly: false })

        let { error, value } = Joi.validate(req.body, schema);
        if (error) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }
        let lObjTestingQuestionCheck = await ABTesting.aggregate([{
          $match: { _id: ObjectId(req.body.testingId) }
        },
        {
          $lookup: { from: 'testingquestions', localField: '_id', foreignField: 'testingId', as: 'testingQuestion' }
        },
        {
          $group: {
            "_id": "$_id",
            "testingQuestion": { $first: "$testingQuestion" }
          }
        }])
        console.log(lObjTestingQuestionCheck[0].testingQuestion)
        if (lObjTestingQuestionCheck[0].testingQuestion.length == 0) {
          return Response.forbiddenError(res, 'Please Add Questions before you publish!!');
        }
        let lObjTestingList = await ABTesting.findByIdAndUpdate({ _id: ObjectId(req.body.testingId) }, { $set: { status: req.body.status }, $addToSet : { joinedMembers : req.user._id } }, { new: true })
        return Response.success(res, lObjTestingList, `Your A/B test ${lObjTestingList.testingName} has been published`);
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /**
     * Get Testing details by Id
     * Input:(header token)
     */
    getTestingDetails: async (req, res) => {
      try {
        let lAryQueryCondition = [
          { "createdUser": ObjectId(req.user._id) },
          { "joinedMembers": ObjectId(req.user._id) }
        ];
        let lObjTestingList = await ABTesting.aggregate([
          {
            $match: {
              _id: ObjectId(req.params.testingId),
              $and: [
                {
                  $or: lAryQueryCondition
                }]
            }
          },
          // let lObjTestingList = await ABTesting.aggregate([{ $match: { _id: ObjectId(req.params.testingId) } },
          { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
          { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
          { $unwind: '$createdUser' },
          {
            $graphLookup: {
              from: "users",
              startWith: "$invitedMembers.email",
              connectFromField: "invitedMembers.email",
              connectToField: "email",
              as: "invitedMemberDetails"
            }
          },
          { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
          {
            $group: {
              _id: "$_id",
              "invitedMembers": {
                "$push": {
                  $cond: {
                    if: { $ne: ["$invitedMembers", null] },
                    then: {
                      '_id': '$invitedMembers._id',
                      'email': '$invitedMembers.email',
                      'firstName': '$invitedMemberDetails.firstName',
                      'lastName': '$invitedMemberDetails.lastName',
                      userName: "$invitedMemberDetails.userName",
                      userId: "$invitedMemberDetails._id",
                      "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$invitedMemberDetails.profilePicture"] }, ""] }
                    },
                    else: {
                      '_id': '$invitedMembers._id',
                      'email': '$invitedMembers.email',
                    },
                  }
                }
              },
              "description": { $first: "$description"},
              "testingName": { $first: "$testingName" },
              "joinedMembers": { $first: "$joinedMembers" },
              "status": { $first: "$status" },
              "type": { $first: "$type" },
              "createdAt": { $first: "$createdAt" }
            }
          },

          {
            $project: {
              "_id": 1,
              "testingName": 1,
              "description": 1,
              "invitedMembers": 1,
              "createdAt": 1,
              "joinedMembers": 1,
              "type": 1,
              "joinedMembersCount": { "$size": { $ifNull: ["$joinedMembers", []] } },
              "status": 1,
              "testingQuestion": 1
            }
          },
          { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
          { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
          { $lookup: { from: 'testingresponses', localField: '_id', foreignField: 'testingId', as: 'testingresponses' } },
          { $unwind: { path: '$testingresponses', 'preserveNullAndEmptyArrays': true } },
          { $lookup: { from: 'testingquestions', localField: 'testingresponses.questionId', foreignField: '_id', as: 'testquestion' } },
          { $unwind: { path: '$testquestion', 'preserveNullAndEmptyArrays': true } },
          {
            $group: {
              _id: "$_id",
              "invitedMembers": { $first: '$invitedMembers' },
              "description" : {$first: '$description'},
              "testingName": { $first: "$testingName" },
              "status": { $first: "$status" },
              "createdAt": { $first: "$createdAt" },
              "type": { $first: "$type" },
              "joinedMembersCount": { $first: "$joinedMembersCount" },
              'joinedMembers': {
                "$addToSet": {
                  '_id': '$joinedMembers._id',
                  'userName': '$joinedMembers.userName',
                  'firstName': '$joinedMembers.firstName',
                  'lastName': '$joinedMembers.lastName',
                  'email': '$joinedMembers.email',
                  "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }, ""] },
                  'vote' : {
                    $cond: {
                    if: { $eq: ["$joinedMembers._id", '$testingresponses.createdUser'] }, then: true, else: false
                  }
                }
                }
              }

            }
          },

          { $lookup: { from: 'testingquestions', localField: '_id', foreignField: 'testingId', as: 'testingQuestion' } },

          {
            $group: {
              "_id": "$_id",
              "testingName": { $first: "$testingName" },
              "description" : {$first: '$description'},
              "invitedMembers": { $first: "$invitedMembers" },
              "joinedMembers": { $first: "$joinedMembers" },
              "type": { $first: "$type" },
              "createdAt": { $first: "$createdAt" },
              "status": { $first: "$status" },
              "joinedMembersCount": { $first: "$joinedMembersCount" },
              "testingQuestion": { $first: "$testingQuestion" }
            }
          },
          { $unwind: { path: '$testingQuestion', 'preserveNullAndEmptyArrays': true } },

          { $lookup: { from: 'testingscreens', localField: 'testingQuestion._id', foreignField: 'questionId', as: 'testingScreens' } },
          {
            $group: {
              "_id": "$_id",
              "testingName": { $first: "$testingName" },
              "description" : {$first: '$description'},
              "invitedMembers": { $first: "$invitedMembers" },
              "joinedMembers": { $first: "$joinedMembers" },
              "createdAt": { $first: "$createdAt" },
              "type": { $first: "$type" },
              "status": { $first: "$status" },
              "joinedMembersCount": { $first: "$joinedMembersCount" },
              "testingQuestion": {
                $push: {
                  $cond: {
                    if: { $eq: ["$testingQuestion.isDeleted", false] }, then: {
                      "isDeleted": "$testingQuestion.isDeleted",
                      "_id": "$testingQuestion._id",
                      "question": "$testingQuestion.question",
                      "comments": "$testingQuestion.comments",
                      "testingscreens": "$testingScreens"
                    }, else: {}
                  }
                }
              }
            }

          }
        ])
        if (lObjTestingList.length > 0) {
          lObjTestingList = lObjTestingList ? lObjTestingList[0] : {}
          lObjTestingList.invitedMembers = _.filter(lObjTestingList.invitedMembers, function (v) {
            return v._id;
          });
          lObjTestingList.joinedMembers = _.filter(lObjTestingList.joinedMembers, function (v) {
            return v._id;
          });

          if (lObjTestingList.testingQuestion) {
            lObjTestingList.testingQuestion = lObjTestingList.testingQuestion.filter(v => Object.keys(v).length && v.testingscreens);
            lObjTestingList.testingQuestionLength = lObjTestingList.testingQuestion.length
            for (let test of lObjTestingList.testingQuestion) {
              for (let screen of test.testingscreens) {
                if (!!screen && screen.image) screen.images = `https://d31qgkthzchm5g.cloudfront.net/screens/${screen.image}`;
                let screenDeta = await ABResponse.find({ screenId: ObjectId(screen._id) }).select('createdUser').populate('createdUser', '_id email firstName lastName userName profilePicture').lean()
                let users = []
                if (screenDeta.length > 0) {
                  for (let userDet of screenDeta) {
                    if (userDet.createdUser)
                      users.push(userDet.createdUser)
                  }
                }

                screen.response = await ABResponse.count({ screenId: ObjectId(screen._id) })
                screen.Respondeduser = users
              }
            }

          }
          return Response.success(res, lObjTestingList, 'Testing Details loaded succesfully');
        } else {
          return Response.forbiddenError(res, "You don't have access for this page!!");
        }

      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /**
      * Update Question (Adding new screens removing screens)
      * Input:(header token)
      */
    updateQuestion: async (req, res) => {
      try {
        if (!!req.fileValidationErr) {
          return Response.badValuesData(res, req.fileValidationErr);
        } else {
          const schema = Joi.object().keys({
            testingId: Joi.string().trim().required(),
            questionId: Joi.string().required(),
            question: Joi.string().required(),
            screenIds: Joi.any(),
            removedScreens: Joi.any()
          })

          let { error, value } = Joi.validate(req.body, schema);
          if (error) {
            let lAryErrorMsg = _.map(error.details, "message")
            return Response.badValuesData(res, lAryErrorMsg);
          }
          value.createdUser = req.user._id;
          let lAryScreenData = [];
          let lAryScreens = req.files;
          let lObjUpdateQuestion = await ABQuestion.update({ _id: ObjectId(req.body.questionId) }, { $set: { question: req.body.question } })
          // Add screens from files
          if (lAryScreens.length > 0) {
            for (let v of lAryScreens) {
              console.log(v.key)
              let lObjRes = await ABScreens.create({
                image: v.key,
                testingId: req.body.testingId,
                questionId: req.body.questionId,
                createdUser: req.user._id,
              })
              lObjRes.images = `https://d31qgkthzchm5g.cloudfront.net/screens/${lObjRes.image}`;
              lAryScreenData.push(lObjRes)
            }
          }
          // Remove screens from Ab screens
          if (typeof (req.body.removedScreens) == "string") {
            req.body.removedScreens = req.body.removedScreens.split(" ");
          }

          if (req.body.removedScreens) {
            for (let screen of req.body.removedScreens) {
              let removeObj = await ABScreens.remove({ _id: screen })
            }
          }
          // Add screens from projects
          if (typeof (req.body.screenIds) == "string") {
            req.body.screenIds = req.body.screenIds.split(" ");
          }
          if (req.body.screenIds !== undefined) {
            let lAryScreenData = [];
            for (let screen of req.body.screenIds) {
              let lObjScreenDetails = await Screens.find({ _id: screen }, { _id: 1, image: 1, projectId: 1 }).lean()
              if (lObjScreenDetails.length > 0) {
                let obj = {
                  image: lObjScreenDetails[0].image,
                  testingId: req.body.testingId,
                  questionId: req.body.questionId,
                  createdUser: req.user._id,
                  parentProjectId: lObjScreenDetails[0].projectId,
                  parentScreenId: lObjScreenDetails[0]._id
                }
                lAryScreenData.push(obj)
              }
            }
            if (lAryScreenData.length > 0) {
              let lObjResScreen = await ABScreens.create(lAryScreenData)
              lObjResScreen.images = `https://d31qgkthzchm5g.cloudfront.net/screens/${lObjResScreen.image}`;
              lAryScreenData.push(lObjResScreen)
            }
            // Check if the testing group exists or not
          }
          return Response.success(res, lAryScreenData, 'Question updated');
        }
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /**
     * Choosing the selected screen by the invited users
     * Input:(header token)
     */
    saveResponse: async (req, res) => {
      try {
        const schema = Joi.object().keys({
          testingId: Joi.string().trim().required(),
          questionResponse: Joi.array()
        }).required().options({ abortEarly: false })

        let { error, value } = Joi.validate(req.body, schema);
        if (error) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }
        value.userId = req.user._id;

        let lArrTestingId = await ABTesting.findOne({ "_id": req.body.testingId }).lean()

        // Check if the testing group exists with published state
        let lObjCheckOwnedGroup = await ABTesting.findOne({ _id: req.body.testingId, status: 2 })
        if (lObjCheckOwnedGroup) return Response.forbiddenError(res, "This focus group has been closed. You can no longer comment!!")
        // Check if the user already responded
        let lObjCheckAlreadyresponded = await ABResponse.findOne({ testingId: req.body.testingId, createdUser: req.user._id })

        if (lObjCheckAlreadyresponded) return Response.forbiddenError(res, "You have already given responses!!")
        let lJoinedMembers = lArrTestingId.joinedMembers;

        if (lArrTestingId.createdUser != req.user._id) {

          if (lJoinedMembers) {
            let lArrayJoinedMenebersId = lJoinedMembers.map(x => {
              return x._id
            })

            var lAryTotalMembers = [...lArrayJoinedMenebersId, lArrTestingId.createdUser].map(String)

            let lResult = lAryTotalMembers.includes(req.user._id.toString())

            if (!lResult) return Response.forbiddenError(res, "Access Denied, If you want to share your comment please join this group first");
          } else {
            return Response.forbiddenError(res, "Access Denied, If you want to share your comment please join this group first");
          }
        }
        let responseResult = []
        for (let response of req.body.questionResponse) {
          let lObjResponse = {
            questionId: response.questionId,
            testingId: req.body.testingId,
            screenId: response.selectedScreen,
            createdUser: req.user._id
          }
          let lObjABResponse = await ABResponse.create(lObjResponse)
          responseResult.push(lObjABResponse)
        }
        await ABTesting.update({ _id: ObjectId(req.body.testingId) }, { $inc: { response: 1 } }, { upsert: true })

        if (lAryTotalMembers) {
          lAryTotalMembers = lAryTotalMembers.map(x => {
            if (x.toString() !== req.user._id.toString()) return x;
          })// Notification won't be send to the user who posted the chat

          for (let member of lAryTotalMembers) {
            if (member) {
              let findUser = await User.find({ "_id": ObjectId(member) })

              let lObjNotification = {
                userId: member,
                notificationType: 'onScreenComment',
                message: `${findUser[0].userName} has edited in the AB Test`,
                createdAt: Date.now()
              }
              let Response = await notification.create(lObjNotification);
            }

          }

          lAryTotalMembers = _.compact(lAryTotalMembers)
          lAryChannels = []
          for (let i of lAryTotalMembers) {
            lAryChannels.push((await User.findById(i).select('channelName')).channelName);
          }

          pusherNotif.votingSocket(lAryChannels, responseResult);
        }
        return Response.success(res, responseResult, 'Thanks for your feedback!!');
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /**
    * Invite users to the AB testing group 
    * Input:(header token)
    */
    inviteMembers: async (req, res) => {
      try {
        let lObjTestingId = req.body.testingId;
        let lAryRecentInvitedList = req.body.invitedMembers;
        console.log(lObjTestingId, req.user._id)
        let lObjTestingDetail = await ABTesting.findOne({ _id: lObjTestingId, createdUser: req.user._id }).lean()
        console.log(lObjTestingDetail)
        if (lObjTestingDetail == null) {
          return Response.badValuesData(res, "You do not have the permission to invite a member to this A/B test!!");
        }
        let lAryAlreadyInvitedLists = lObjTestingDetail.invitedMembers;
        let lAryAlreadyJoinedMenmberEmail = await ABTesting.aggregate([{
          $match: { _id: ObjectId(lObjTestingId) }
        },
        { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
        { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
        { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
        {
          $group: {
            _id: "$_id",
            "joinedMembers": {
              "$push": {
                $cond: {
                  if: { $ne: ["$joinedMembers", null] },
                  then: {
                    'email': '$joinedMembers.email'
                  },
                  else: {
                    '_id': '$joinedMembers._id',
                    'email': '$joinedMembers.email',
                  },
                }
              }
            }

          }
        }
        ]);
        if (lAryAlreadyJoinedMenmberEmail.length > 0) {
          lAryAlreadyJoinedMenmberEmail = lAryAlreadyJoinedMenmberEmail[0].joinedMembers
          //Check the invited member already joined in this group or not, If yes throw the notification to avoid duplicate
          // let lAryErrMessage = [];
          for (let x of lAryAlreadyJoinedMenmberEmail) {
            const index = lAryRecentInvitedList.indexOf(x.email)

            if (-1 !== index) {
              delete lAryRecentInvitedList[index];

            }
          }
        }
       
        if (!lAryRecentInvitedList[0]) {
          return Response.badValuesData(res, "Members already is in Joined list");
        } else {

          let lAryInvitedMembers = [];
          let lArySendInviteEmail = [];
          //Check the invited member is already invited to this group or not, If yes ignore the existing one and post the new one
          for (let i in lAryAlreadyInvitedLists) {
            let x = lAryAlreadyInvitedLists[i];
            if (lAryRecentInvitedList.includes(x.email)) {

              //Check the existing user token if it doesn't expire sent the mail to the user onemore time with existing token
              await jwt.verify(x.invitationToken, process.env.SUPER_SECRET, async (err, decoded) => {
                if (decoded) {
                  lArySendInviteEmail.push({
                    email: x.email,
                    invitationToken: x.invitationToken
                  });
                  lAryRecentInvitedList = _.without(lAryRecentInvitedList, x.email)
                } else if (err.name === "TokenExpiredError") {
                  //If the user token expires remove the user from invited member key and add the new one for avoiding duplicates
                  await ABTesting.findOneAndUpdate({
                    _id: lObjTestingId,
                    "invitedMembers.email": x.email
                  }, {
                      $pull: { invitedMembers: { email: x.email } }
                    },
                    {
                      new: true
                    })
                }
              })
            }
          }
          console.log(lAryRecentInvitedList)
          //GENERATE TOKEN FOR NEW USERS
          for (let v of lAryRecentInvitedList) {
            let expiry = '30 days'; //Expires in 30 day
            const { _id, testingName } = lObjTestingDetail,
              tokenData = { _id, v, testingName };

            let token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
              expiresIn: expiry
            });
            lAryInvitedMembers.push({ email: v, invitationToken: token })
            lArySendInviteEmail.push({ email: v, invitationToken: token }) // SEND EMAIL TO ALL THE USERS INCLUDING EXISTING USER
          }

          let lObjTesting;
          //UPDATE THE NEW USER DETAILS IN DB 
          if (lAryInvitedMembers.length > 0) {
            lObjTesting = await ABTesting.findOneAndUpdate({
              _id: lObjTestingId
            }, {
                $addToSet: {
                  invitedMembers: lAryInvitedMembers
                }
              },
              {
                new: true
              });

            await lAryInvitedMembers.filter(async function (invite) {
              let checkExists = await UserInvite.find({ userId: req.user._id, email: invite.email })
              if (checkExists.length == 0) {
                await UserInvite.create({
                  userId: req.user._id,
                  email: invite.email
                })
              }
            })

            //Send Email to all the user who are invited
            for (let v of lArySendInviteEmail) {
              let mailData = {
                userName: req.user.userName,
                email: v.email,
                groupName: lObjTesting.testingName,
                link: `${process.env.BASE_URL}abtesting/${lObjTestingId}?token=${v.invitationToken}`
              }
              mailer.testingInvitationEmail(mailData)
            }
            //Notification(For Socket Purpose)
            let lObjTestingRes = await ABTesting.aggregate([{
              $match: { "_id": ObjectId(lObjTestingId) }
            },
            { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },

            { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
            { $unwind: '$createdUser' },
            {
              $graphLookup: {
                from: "users",
                startWith: "$invitedMembers.email",
                connectFromField: "invitedMembers.email",
                connectToField: "email",
                as: "invitedMemberDetails"
              }
            },
            { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
            {
              $group: {
                _id: "$_id",
                "invitedMembers": {
                  "$push": {
                    $cond: {
                      if: { $ne: ["$invitedMembers", null] },
                      then: {
                        '_id': '$invitedMembers._id',
                        'email': '$invitedMembers.email',
                        userName: "$invitedMemberDetails.userName",
                        userId: "$invitedMemberDetails._id",
                        invitationToken: '$invitedMembers.invitationToken',
                        "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$invitedMemberDetails.profilePicture"] }, ""] }
                      },
                      else: {
                        '_id': '$invitedMembers._id',
                        'email': '$invitedMembers.email',
                      },
                    }
                  }
                },
                "testingName": { $first: "$testingName" },
                "status": { $first: "$status" },
                "description": { $first: "$description" },
                "createdUser": { $first: '$createdUser' },
                'joinedMembers': { $first: "$joinedMembers" },
                "createdAt": { $first: "$createdAt" }
              }
            },

            { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
            { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
            {
              $group: {
                _id: "$_id",
                "invitedMembers": { $first: '$invitedMembers' },
                "testingName": { $first: "$testingName" },
                "status": { $first: "$status" },
                "description": { $first: "$description" },
                "createdUser": { $first: '$createdUser' },
                'joinedMembers': {
                  "$push": {
                    '_id': '$joinedMembers._id',
                    'userName': '$joinedMembers.userName',
                    'email': '$joinedMembers.email',
                    "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }, ""] },
                  }
                },
                "createdAt": { $first: "$createdAt" },

              }
            }, {
              $project: {
                _id: "$_id",
                "invitedMembers": 1,
                "testingName": 1,
                "status": 1,
                "description": 1,
                "createdUser": {
                  '_id': '$createdUser._id',
                  'isAdmin': true,
                  'userName': '$createdUser.userName',
                  'email': '$createdUser.email',
                  "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
                },
                'joinedMembers': 1,
                "createdAt": 1,
              }
            }

            ])
            lObjTestingRes = (lObjTestingRes) ? lObjTestingRes[0] : {}
            if (lObjTestingRes) {
              let lObjInvited = lObjTestingRes.invitedMembers
              let lObjEmail = lAryInvitedMembers.map(e => e.email)
              lObjInvited = lObjInvited.filter(v => lObjEmail.includes(v.email)
              )
              
              for (let i of lObjInvited) {
                if (i.userId) {
                  console.log({
                    'userId': i.userId,
                    "invitationToken": i.invitationToken,
                    'testingId': lObjTestingRes._id,
                    notificationType: 'addMembers',
                    message: `${lObjTestingRes.createdUser.userName} invite you to join in our ABTesting ${lObjTestingRes.testingName}.`
                  })
                  let lObjNotifData = await notification.create({
                    'userId': i.userId,
                    "invitationToken": i.invitationToken,
                    'testingId': lObjTestingRes._id,
                    notificationType: 'addMembers',
                    message: `${lObjTestingRes.createdUser.userName} has invited you join their ABTesting ${lObjTestingRes.testingName}.`
                  })
                  let lObjNotifChannel = (await User.findById(i.userId).select('channelName')).channelName;
                  let lObjNotificationMsg = await notification.find({ _id: ObjectId(lObjNotifData._id) })

                  pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                }
              }
            }
                        
            lObjTestingRes.joinedMembers = [...lObjTestingRes.joinedMembers, lObjTestingRes.createdUser]
            let lObjTestingResult = sanitize(lObjTestingRes)//Remove Sensitive Data
            
            return Response.success(res, lObjTestingResult, 'An invite has been sent to the user');
          } else {
            return Response.badValuesData(res, "Members already is in invited list");

          }
        }
      } catch (err) {
        console.log(err, "Catch ERR");
        return Response.errorInternal(err, res)
      }
    },
    /**
    * Accepting the Invitation by the users
    * Input:(header token), token of the invitation in req body
    */
    jointheGroup: async (req, res) => {
      try {
        let token = req.body.token;
        if (token) {
          console.log({
            _id: ObjectId(req.body.testingId),
            status: { $ne: 0 },
            createdUser: ObjectId(req.user._id)
          })
          let lObjCheckCurrentUser = await ABTesting.findOne({
            _id: ObjectId(req.body.testingId),
            status: { $eq: 1 },
            createdUser: ObjectId(req.user._id)
          })

          if (lObjCheckCurrentUser !== null) return Response.forbiddenError(res, "You can't accept the invitation!!");

          let lObjCheckUserInvitedOrNot = await ABTesting.findOne({
            _id: req.body.testingId,
            status: { $eq: 1 },
            $and: [
              { "invitedMembers.email": req.user.email },
              { "invitedMembers.invitationToken": token }
            ]
          }).lean()

          let lObjJoinendMembers = await ABTesting.find({ _id: ObjectId(req.body.testingId) })
          let lArrayJoinedMenebersId = []
          if (lObjJoinendMembers.joinedMembers) {
            lArrayJoinedMenebersId = lObjJoinendMembers[0].joinedMembers.map(x => {
              return x._id
            })
          }
         
          let memberExists = lObjJoinendMembers[0].joinedMembers.indexOf(req.user._id)
          if (memberExists >= 0) return Response.noAccess(res, "you have alredy joined in this group!!")
          if (lObjCheckUserInvitedOrNot === null) return Response.forbiddenError(res, "You have not been invited to this A/B test")
         
          //This is a middleware to compute validity of token

          let ljwtDecode = await verify.verifyAcceptToken(token)

          if (ljwtDecode) {
            await UserBadge.abTestingParticipated(req.user._id);
            let updateQuery = await ABTesting.findOneAndUpdate(
              {
                testingName: ljwtDecode.testingName,
                joinedMembers: { $nin: [req.user._id] },
                "invitedMembers.email": req.user.email
              }, {
                $addToSet: { joinedMembers: req.user._id },
                $pull: {
                  invitedMembers: { email: req.user.email }
                }
              }, {
                new: true
              });
            if (updateQuery == null) {
              return Response.success(res, updateQuery, 'This user is already a member of the group')
            } else {
              return Response.success(res, updateQuery, 'Joined the group successfully')
            }
          }
        } else {
          return Response.badValuesData(res, "Token Missing")
        }
      } catch (e) {
        console.log(e)
        return Response.errorInternal(e, res)
      }
    },

    acceptInvitation: async (req, res) => {
      try {
        let token = req.query.token;
        if (token) {

          let lObjCheckCurrentUser = await ABTesting.findOne({
            _id: req.params.testingId,
            status: { $ne: 3 },
            createdUser: req.user._id
          }).lean()
          console.log(lObjCheckCurrentUser)
          if (lObjCheckCurrentUser !== null) return Response.success(res, "success");

          let lObjCheckUserInvitedOrNot = await ABTesting.findOne({
            _id: req.params.testingId,
            status: { $ne: 3 },
            $and: [
              { "invitedMembers.email": req.user.email },
              { "invitedMembers.invitationToken": token }
            ]
          }).lean()

          if (lObjCheckUserInvitedOrNot === null) return Response.forbiddenError(res, "You have not been invited to this AB Testing")

          let Notificationstatus = await notification.findOne({ "_id": ObjectId(req.params.notificationId), "isDeleted": false });

          if (Notificationstatus) {
            await notification.update({ "_id": ObjectId(req.params.notificationId) }, { $set: { "isDeleted": true } });

            let create = await notification.create({ "userId": ObjectId(req.user._id), "notificationType": "updateMembers", "message": `You have joined in the AB Testing` });
            console.log(create, 'create notification')
          }

          await UserBadge.abTestingParticipated(req.user._id);

          //This is a middleware to compute validity of token
          jwt.verify(token, process.env.SUPER_SECRET, (err, decoded) => {
            if (err) return Response.error(res, 400, err);
            if (decoded) {
              console.log(decoded, "decoded ************")
              ABTesting.findOneAndUpdate(
                {
                  testingName: decoded.testingName,
                  joinedMembers: { $nin: [req.user._id] },
                  "invitedMembers.email": req.user.email
                }, {
                  $addToSet: { joinedMembers: req.user._id },
                  $pull: {
                    invitedMembers: { email: req.user.email }
                  }
                }, {
                  new: true
                },
                (err, data) => {
                  if (err) {
                    console.log(err)
                    return Response.error(res, 400, err);
                  } else if (data !== null) {
                    data = sanitize(data)//Remove Sensitive Data
                    
                    if (req.body.returnResponse !== false) return Response.success(res, data, 'Joined the AB Testing successfully')
                  } else {
                    return Response.success(res, data, `You've already joined this AB Testing`)
                  }
                })
            } else {
              return Response.notAuthorized(res, "Not a Valid Token")
            }
          });
        } else {
          return Response.badValuesData(res, "Token Missing")
        }
      } catch (e) {
        console.log(e)
        return Response.errorInternal(e, res)
      }
    },
    /**
     * Decline to join in the AB Testing
     */
    declineToJoin: async (req, res) => {
      try {
        let token = req.body.token;
        if (token) {
          let lObjCheckCurrentUser = await ABTesting.findOne({
            _id: req.body.testingId,
            status: { $ne: 3 },
            createdUser: req.user._id
          }).lean()
          if (lObjCheckCurrentUser !== null) return Response.success(res, "No Active AB Testing");

          let lObjCheckUserInvitedOrNot = await ABTesting.findOne({
            _id: req.body.testingId,
            status: { $ne: 3 },
            $and: [
              { "invitedMembers.email": req.user.email },
              { "invitedMembers.invitationToken": token }
            ]
          }).lean()
          let updateQuery = await ABTesting.findOneAndUpdate(
            {
              joinedMembers: { $nin: [req.user._id] },
              "invitedMembers.email": req.user.email
            }, {
              $pull: {
                invitedMembers: { email: req.user.email }
              }
            }, {
              new: true
            });
          if (updateQuery == null) {
            return Response.success(res, updateQuery, 'This user is already a member of the AB Testing')
          } else {
            let updateNotification = await notification.update({ _id: ObjectId(req.body.notificationId) }, { $set: { isDeleted: true } })

            if (lObjCheckUserInvitedOrNot) {

              let lAryChannels = [];
              let Notify = await notification.create({
                'userId': lObjCheckUserInvitedOrNot.createdUser,
                'testingId': req.body.testingId,
                notificationType: 'updateMembers',
                message: `${req.user.userName} has Declined to Join in AB Testing ${lObjCheckUserInvitedOrNot.testingName}.`
              })

              lAryChannels.push((await User.findById(lObjCheckUserInvitedOrNot.createdUser).select('channelName')).channelName);
              let lUserDetails = await notification.find({ _id: ObjectId(Notify._id) })
              pusherNotif.sendNotification(lAryChannels, lUserDetails);
            }
            return Response.success(res, updateQuery, 'Declined to the join the AB Testing !!')
          }
        } else {
          return Response.badValuesData(res, "Token Missing")
        }

      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    /*
     *Delete Question in the testing group
     * Input (header Token)
    */
    deleteQuestion: async (req, res) => {
      try {
        const schema = Joi.object().keys({
          testingId: Joi.string().trim().required(),
          questionId: Joi.string().trim().required()
        }).required().options({ abortEarly: false })

        let { error, value } = Joi.validate(req.body, schema);
        if (error) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }
        value.userId = req.user._id;
        let checkTesting = await ABTesting.find({ _id: ObjectId(req.body.testingId), createdUser: ObjectId(req.user._id), status: { $eq: 0 } })
        if (checkTesting == null) {
          return Response.forbiddenError(res, 'you dont have enough permission to add question to this group!!')
        }
        let deleteQuestion = await ABQuestion.update({ _id: ObjectId(req.body.questionId), testingId: ObjectId(req.body.testingId) }, { $set: { isDeleted: true } })
        if (deleteQuestion) {
          return Response.success(res, 'Question removed succesfully!!')
        }
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },

    getVoterDetails: async (req, res) => {
      try {
        let checkTesting = await ABResponse.find({ questionId: ObjectId(req.params.questionId) }).select('createdUser').populate('createdUser', '_id email firstName lastName userName profilePicture').lean()
        return Response.success(res, checkTesting, 'voted Member details the group successfully')
      } catch (error) {
        return Response.errorInternal(error, res)

      }
    },
    /*
      Get Recent five Members in Testing Group
      Input (header token)
     */
    recentTestingMembers: async (req, res) => {
      try {
        let inviteMailId = [], joinedMailId = [];
        let recentMember = await ABTesting.findById({ _id: req.params.testingId });

        if (recentMember && recentMember != null) {
          await recentMember.invitedMembers.filter(function (member) {
            if (member) {
              inviteMailId.unshift(member.email);
            }
          })
          await recentMember.joinedMembers.filter(async function (member) {
            if (member) {
              let getJoinedMailId = await User.findById(member);
              joinedMailId.push(getJoinedMailId.email);
            }
          })

          let email = await inviteMailId.concat(joinedMailId);
          email = email.slice(0, 5);
          return Response.success(res, email, 'Recently invited members');
        } else {
          return Response.message(res, 200, 'Not Found');
        }
      } catch (err) {
        return Response.errorInternal(err, res)
      }
    },

    /*
      Update Testing Status (Delete - 3 Or Archieve - 4 Testing)
     */
    updateTestingStatus: async (req, res) => {
      try {
        let testingId = req.params.testingId;
        let status = req.params.status;
        
        let checkOwnTesting = await ABTesting.find({_id : ObjectId(testingId), createdUser : ObjectId(req.user._id) });
        
        if(checkOwnTesting.length > 0 && status == 4) {
          let checkIsPublish = await ABTesting.find({_id : ObjectId(testingId), status : 1});
        
          if(checkIsPublish.length > 0) {
            return Response.noAccess(res, 'If you want to Archieve this testing, Please do before Publishing!! ')
          } else {
            let update = await ABTesting.findByIdAndUpdate({_id: ObjectId(testingId)}, { $set : { status : status }})
            return Response.success(res, update, `${checkOwnTesting[0].testingName} Archieve successfully...`)
          }

        } else if(checkOwnTesting.length > 0 && status == 3) {

          let update = await ABTesting.findByIdAndUpdate({_id: ObjectId(testingId)}, { $set : { status : status }})
          return Response.success(res, update, `${checkOwnTesting[0].testingName} deleted successfully...`)

        } else if (checkOwnTesting.length > 0 && status == 0) {

          let update = await ABTesting.findByIdAndUpdate({_id: ObjectId(testingId)}, { $set : { status : status }})
          return Response.success(res, update, `${checkOwnTesting[0].testingName} saved successfully...`)

        } else if(checkOwnTesting.length > 0 && status == 2) {

          let update = await ABTesting.findByIdAndUpdate({_id: ObjectId(testingId)}, { $set : { status : status }})
          return Response.success(res, update, `${checkOwnTesting[0].testingName} closed successfully...`)
          
        } else {
          return Response.forbiddenError(res, 'You do not have the permission to this Action')
        }
      } catch(err) {
        return Response.errorInternal(err, res)
      }
    }
  }
  return Object.freeze(methods)
}

module.exports = abTestingComponentCtrl()