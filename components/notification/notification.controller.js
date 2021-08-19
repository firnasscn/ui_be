const Response = require('../../utils/response');
const Notification = require('../notification/notification.model');
const Screen = require('../screens/screens.model')
const Joi = require('joi');
const _ = require('lodash');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

let gIntDataPerPage = 10;

//Pusher Configuration

function notifComponentCtrl(model) {
  const methods = {
    listAllNotifications: async (req, res) => {
      try {
        //Pagination
        gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 10 : parseInt(req.query.offset)

        let page = req.query.page || 1;
        let skipRec = page - 1;
        skipRec = skipRec * gIntDataPerPage;

        let lAryNotificationData = await Notification.find({ userId: req.user._id, isDeleted: false }).sort('-createdAt').skip(skipRec).limit(gIntDataPerPage)
        let lIntNoOfNotifications = await Notification.count({ userId: req.user._id, isDeleted: false });
        let lIntNoOfUnreadNotifications = await Notification.count({ userId: req.user._id, isDeleted: false, isSeen: false });

        let lObjNotification = {
          unreadCount: lIntNoOfUnreadNotifications,
          notificationList: lAryNotificationData,
          total: Math.ceil(lIntNoOfNotifications / gIntDataPerPage),
          per_page: gIntDataPerPage,
          currentPage: page
        }

        return Response.success(res, lObjNotification, "Notification list");
      } catch (err) {
        return Response.errorInternal(err, res);
      }
    },
    updateViewStatus: async (req, res) => {
      try {
        await Notification.update({ "userId": ObjectId(req.user._id) }, { $set: { "isSeen": true } }, { multi: true });
        let lIntNoOfUnreadNotifications = await Notification.count({ userId: req.user._id, isDeleted: false, isSeen: false });
        let lObjNotification = {
          unreadCount: lIntNoOfUnreadNotifications
        }
        return Response.success(res, lObjNotification, "Notification viewed.");
      } catch (e) {
        return Response.errorInternal(err, res);
      }
    }
  }
  return Object.freeze(methods)
}

module.exports = notifComponentCtrl()
