function businessPortalRoutes() {
    let ctrl = require('./businessPortal.controller')
    return (open, closed, both) => {
        both.route('/business/waitListUserDetails').get(ctrl.waitListUserDetails)
        both.route('/business/approveUser').patch(ctrl.approveUser)
        both.route('/business/createPlan').post(ctrl.createPlan)
        both.route('/business/getAllPlan').get(ctrl.getAllPlan)
        both.route('/business/updatePlan').patch(ctrl.updatePlan)
        both.route('/business/deletePlan/:planId').delete(ctrl.deletePlan)
        both.route('/business/discountApi').post(ctrl.discountApi)
        both.route('/business/planUserApi').post(ctrl.planUserApi)
        both.route('/business/getPricingPlan').get(ctrl.getPricingPlan)
        both.route('/business/listOfUserDetails').get(ctrl.listOfUserDetails)
        open.route('/business/businessUserSignUp').post(ctrl.businessUserSignUp)
        open.route('/business/login').post(ctrl.businessLogin)
        both.route('/business/logout').get(ctrl.businessLogout)

        both.route('/business/usageReport').get(ctrl.usageReport)
    }
}

module.exports = businessPortalRoutes()