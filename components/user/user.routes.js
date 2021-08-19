function userComponentRoutes() {
  const ctrl = require('./user.controller');
  const fileUpload = require('../../utils/fileUpload');

  return (open, closed) => {
    open.route('/user').get(ctrl.getAnonymousUser)
    closed.route('/user').get(ctrl.me)
    closed.route('/user').all(fileUpload.upload.single('profilePicture')).put(ctrl.updateProfile)
    closed.route('/user/updateProfilePicture').all(fileUpload.upload.single('profilePicture')).put(ctrl.updateProfilePic)
    closed.route('/user/changePassword').put(ctrl.changePassword)
    closed.route('/user/logout').get(ctrl.logout)
    closed.route('/user/getAllInvitedmembers').get(ctrl.getAllInvitedmembers)
  }
}

module.exports = userComponentRoutes()
