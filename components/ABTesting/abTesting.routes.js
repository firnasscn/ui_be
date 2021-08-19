require("dotenv").config();

function componentOneRoutes() {
  const ctrl = require('./abTesting.controller')
  const fileUpload = require('../../utils/fileUpload')

  return (open, closed) => {
    closed.route('/abTesting/acceptInvitation/:testingId/:notificationId').post(ctrl.acceptInvitation)
    closed.route('/abTesting/declineInvite').post(ctrl.declineToJoin)
    closed.route('/abTesting/createNew').post(ctrl.createNewTesting)
    closed.route('/abTesting/addQuestions').all(fileUpload.upload.array('screens')).post(ctrl.addQuestion)
    closed.route('/abTesting/list').get(ctrl.listTesting)
    closed.route('/abTesting/comment').post(ctrl.postComment)
    closed.route('/abTesting/changeStatus').put(ctrl.publishTesting)
    closed.route('/abTesting/get/:testingId').get(ctrl.getTestingDetails)
    closed.route('/abTesting/update').all(fileUpload.upload.array('screens')).post(ctrl.updateQuestion)
    closed.route('/abTesting/inviteMembers').post(ctrl.inviteMembers)
    closed.route('/abTesting/acceptInvite').post(ctrl.jointheGroup)
    closed.route('/abTesting/saveResponse').post(ctrl.saveResponse)
    closed.route('/abTesting/deleteQuestion').post(ctrl.deleteQuestion)
    closed.route('/abTesting/getVoterDetails/:questionId').get(ctrl.getVoterDetails)
    closed.route('/abTesting/collaboratorsList').get(ctrl.collaboratorsList)
    closed.route('/abTesting/recentTestingMembers/:testingId').get(ctrl.recentTestingMembers)
    closed.route('/abTesting/updateTestingStatus/:testingId/:status').put(ctrl.updateTestingStatus);
  }
}

module.exports = componentOneRoutes()