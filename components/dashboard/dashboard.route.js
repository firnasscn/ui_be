function dashBoardRoutes() {
    let ctrl = require('./dashboard.controller')
    return (open, closed) => {
        closed.route('/dashboard/getMyProjects').get(ctrl.getMyProjects)
        closed.route('/dashboard/getMyFocusgroups').get(ctrl.getMyFocusgroup)
        closed.route('/dashboard/getMyInvitedProjects').get(ctrl.getInvitedProjectList)
        closed.route('/dashboard/getHotspotCount').get(ctrl.getHotspotsCount)
        closed.route('/dashboard/getActionTypeDetail/:actionId').get(ctrl.getActionTypeDetail)
        closed.route('/dashboard/getFlaggedItemDetail').get(ctrl.getFlaggedItemDetail)
        closed.route('/dashboard/getAssignedItemDetail').get(ctrl.getAssignedItemDetail)
        closed.route('/dashboard/byProjects').get(ctrl.byProjectFilter)
        closed.route('/dashboard/byFocusGroup').get(ctrl.byFocusGroupFilter)
        closed.route('/dashboard/byRaisedFilter').get(ctrl.byRaisedFilter)
        closed.route('/dashboard/projectIssueChart').get(ctrl.projectIssueChart)
        closed.route('/dashboard/personWiseChart').get(ctrl.personWiseChart)
        closed.route('/dashboard/byAssignedFilter').get(ctrl.byAssignedFilter)
        closed.route('/dashboard/getFGDetail').get(ctrl.getFGDetail)
    }
}

module.exports = dashBoardRoutes()