function focusGroupComponentRoutes() {
  const ctrl = require('./focusGroup.controller')
  const { routePrefix } = require('../../utils')

  return (open, closed) => {
    closed.route('/focusGroup/acceptInvitation/:groupId/:notificationId').post(ctrl.acceptInvitation)
    closed.route('/focusGroup/acceptInvite/').post(ctrl.jointheGroup)
    closed.route('/focusGroup/declineInvite/').post(ctrl.declineToJoinGroup)
    closed.route('/focusGroup/createNew').post(ctrl.createNewFocusGroup)
    closed.route('/focusGroup/listAllGroups').get(ctrl.ListAllFocusGroup)
    closed.route('/focusGroup/listAllInvitedGroups').get(ctrl.getUserInvitedGroups)
    closed.route('/focusGroup/joinGroup').post(ctrl.joiningAGroup)
    open.route('/focusGroup/:groupId').get(ctrl.getMyFocusGroup)
    open.route('/focusGroup/createAnonymousUser').post(ctrl.createAnonymous)
    closed.route('/focusGroup/edit/:groupId').get(ctrl.editMyFocusGroup)
    closed.route('/focusGroup/addMembers/:groupId').post(ctrl.addMembers)
    closed.route('/focusGroup/edit/:groupId').patch(ctrl.editFocusGroup)
    closed.route('/focusGroup/update/:groupId/:status').put(ctrl.deleteFocusGroup)
    closed.route('/focusGroup/removeMember/:groupId').patch(ctrl.removeMember)
    closed.route('/focusGroup/get/:focusId').get(ctrl.getFocusGroupById);
    closed.route('/focusGroupList').get(ctrl.focusGroupList);
    closed.route('/focusGroupList/collaboratorsList').get(ctrl.collaboratorsList)
    closed.route('/focusGroup/recentFGMembers/:groupId').get(ctrl.recentFGMembers)
    closed.route('/focusGroup/createFocusGroup').post(ctrl.createNew)
    closed.route('/focusGroup/settings').post(ctrl.shareLink)
    closed.route('/focusGroup/inviteMembers/:groupId').post(ctrl.inviteMembers)
    closed.route('/focusGroup/addScreens').post(ctrl.addScreenToFocusGroup)
    open.route('/focusGroup/createAnonymousUser').post(ctrl.createAnonymous)

    closed.route('/focusGroup/deleteScreens/:focusGroupId').delete(ctrl.deleteScreens)
    closed.route('/focusGroup/new').post(ctrl.createFG)
    
    open.route('/pusher/presence_auth').post(ctrl.presenceAuth)
    closed.route('/focusGroup/checkFGMap').get(ctrl.checkFocusgroupMapping)
    closed.route('/focusGroup/mapFgToProject').put(ctrl.mapFGToProject)
  }
}

module.exports = focusGroupComponentRoutes()
