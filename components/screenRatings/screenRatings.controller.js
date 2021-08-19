require("dotenv").config();
const Comments = require('../comments/comments.model');
const Ratings = require('./screenRatings.model');
const Screens = require('../screens/screens.model');
const RatingsType = require('../screenRatingType/screenRatingType.model');
const RatingsTag = require('../screenTags/screenTags.model');
const Response = require('../../utils/response')
const UserBadge = require('../../utils/userBadge');;
const mongoose = require('mongoose');
const Joi = require('joi');
const _ = require('lodash');
const ObjectId = mongoose.Types.ObjectId;
const pusherNotif = require('../../utils/pusher')
let gIntDataPerPage = 10;

function validateSchema(input, obj) {
  let { error } = Joi.validate(input, Joi.object().keys(obj));

  if (error)
    return _.map(error.details, "message");
}

function commentComponentCtrl(model) {
  const methods = {


    postProjectRating: async (req, res) => {
      try {
        let validate = {
          'screenId': Joi.string().alphanum().length(24).required(),
          'ratings': Joi.object().required()
        };

        let error = validateSchema(req.body, validate);
        if (error) return Response.badValuesData(res, error);
        let lObjCommentDisable = await Screens.find({ _id: ObjectId(req.body.screenId) })
        let screenId = req.body.screenId;
        let userId = req.user._id;
        let lObjBody = {
          screenId: screenId,
          userId: userId
        }
        let lObjFirstRating = await Ratings.find({ 'screenId': screenId, 'userId': userId })
        let lObjCommentId
        if (lObjFirstRating.length == 0) {
          let lObjComment = await Comments.create(lObjBody)
          lObjCommentId = lObjComment._id
          await UserBadge.screenCommentsTracking(req.user._id);
          await UserBadge.screenCommentsReceived(lObjCommentDisable[0].userId);
        } else {
          lObjCommentId = lObjFirstRating[0].commentId
        }

        let v = req.body.ratings
        let comment = await Ratings.findOneAndUpdate({
          'screenId': screenId,
          'userId': userId
        }, {
            $set: {
              'screenId': screenId,
              'userId': userId,
              'ratingTypeId': v.ratingTypeId,
              'comment': v.tags,
              'vote': 1,
              'commentId': lObjCommentId
            }
          }, { upsert: true, new: true })
        await Comments.update({ _id: lObjCommentId._id }, { $set: { userId: req.user._id } })
        UserBadge.screenRatingReceived(lObjCommentDisable[0].userId)
        UserBadge.screenRatingTracking(req.user._id)
        UserBadge.avgRatingReceived(lObjCommentDisable[0].userId)
        let rating = await Ratings.aggregate([
          { $match: { "screenId": ObjectId(screenId) } },
          { $lookup: { from: 'screenratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
          { $unwind: '$ratingTypeId' },
          { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
          { $unwind: '$userId' },
          {
            $group: {
              _id: { "screenId": "$screenId", ratingTypeId : '$ratingTypeId._id' },
              'ratingTypeId': { $first: '$ratingTypeId' },
              "count" : {$sum : 1}
            }
          },
          {
            $group: {
              _id: "$_id",
              "ratings": {
                "$push": {
                  'ratingType': '$ratingTypeId.name',
                  'ratingId': '$ratingTypeId._id',
                  "vote" : "$count"
                }
              },
              
            }
          },
         
        ])
        // rating = await rating[0].ratings
        let ratings = [];
         await rating.filter(async rate => {
          await delete rate._id;
          let data = await rate.ratings[0];
          console.log(data)
          ratings.push(data)
        })
       
        let data = await {comment, ratings}
        return Response.success(res, data, 'Rating Posted Successfully');
      }
      catch (err) {
        console.log(err);
        return Response.errorInternal(err, res);
      }
    },

    listAllRatingsType: async (req, res) => {
      try {
        let lAryRatingsType = await RatingsType.find().sort({ icon: 1 }).lean()
        return Response.success(res, lAryRatingsType, 'Ratings Type');
      } catch (err) {
        return Response.errorInternal(err, res);
      }
    },
    listAllRatingsTags: async (req, res) => {
      try {
        let lAryRatingsTags = await RatingsTag.find().lean()
        return Response.success(res, lAryRatingsTags, 'Ratings Tags');
      } catch (err) {
        return Response.errorInternal(err, res);
      }
    },
    getMyScreenRatings: async (req, res) => {
      try {

        let lAryRatings = await Ratings.aggregate([
          {
            $match: {
              "screenId": ObjectId(req.params.screenId),
              "userId": ObjectId(req.user._id)
            }
          }, {
            $group: {
              _id: "$screenId",
              "ratings": {
                "$push": {
                  "comment": "$comment",
                  "vote": "$vote",
                  "ratingTypeId": "$ratingTypeId",
                  "_id": "$_id"
                }
              }
            }
          }, {
            $project: { _id: 0, screenId: "$_id", "ratings": 1 }
          }
        ])
        return Response.success(res, lAryRatings[0] || {}, 'My Ratings');
      } catch (err) {
        return Response.errorInternal(err, res);
      }
    }

  }
  return Object.freeze(methods);
}

module.exports = commentComponentCtrl();
