function landingPageComponentRoutes() {
    const ctrl = require('./landingPage.controller')
    const { routePrefix } = require('../../utils')

    return (open, closed) => {
        open.route('/home/getAllCategories').get(ctrl.getAllCategories)
        open.route('/home/getAllScreenTypes').get(ctrl.getAllScreenTypes)
        open.route('/home/getEmail').post(ctrl.getEmailFromLP)
        open.route('/home/exportReport').get(ctrl.exportReport)
        open.route('/home/userReport').get(ctrl.userReport)
        open.route('/home/elasticSearch/').post(ctrl.searchList)
        open.route('/home/createOccupation').post(ctrl.createOccupation)
        open.route('/home/getAllOccupations').get(ctrl.getAllOccupations)
        open.route('/home/landingPageScreens').post(ctrl.landingPageScreens)
        open.route('/home/:type').post(ctrl.popular);
        open.route('/home/search').post(ctrl.searchM);
        open.route('/home/screenDetail/:screenId').get(ctrl.screenDetail)
        open.route('/home/projectScreenDetail/:screenId').get(ctrl.projectScreenDetail)
        closed.route('/user/getAllCategories').get(ctrl.getAllCategories)
        closed.route('/user/getAllScreenTypes').get(ctrl.getAllScreenTypes)
        open.route('/home/listAllComments/:screenId').get(ctrl.listAllComments)
        closed.route('/userinvited/getAllInvitedmembers').get(ctrl.getAllInvitedmembers)
        closed.route('/badge/compareBadgeProperties').post(ctrl.compareBadgeProperties)
        closed.route('/home/dashBoardScreens').get(ctrl.dashBoardScreens)
        open.route('/home/db').get(ctrl.dbMigrationChanges);

    }
}

module.exports = landingPageComponentRoutes()