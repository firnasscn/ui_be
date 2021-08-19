function projectComponentRoutes() {
    const ctrl = require('./payment.controller')
    const { routePrefix } = require('../../utils')

    return (open, closed) => {
        closed.route('/payment/order').post(ctrl.createNewOrder)
        closed.route('/payment/addPlan').post(ctrl.addPlan)
        closed.route('/payment/listPaymentPlan').get(ctrl.listPaymentPlan)
        closed.route('/payment/userPlan').get(ctrl.userPlan)
        closed.route('/payment/updateStatus').post(ctrl.updatePaymentStatus)
        closed.route('/payment/createPayment').post(ctrl.createPayment)
        closed.route('/payment/createPlan').post(ctrl.createPlan)
        closed.route('/payment/listPlan').get(ctrl.listPlan)
    }
}

module.exports = projectComponentRoutes()
