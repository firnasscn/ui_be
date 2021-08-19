function AdminRoutes() {
    let ctrl = require('./adminReport.controller');
    return (open, closed) => {
        open.route('/report/newUsers').get(ctrl.newUsers);
        open.route('/report/existingUserLoggedin').get(ctrl.existingUserLoggedIn)
        open.route('/report/userReport').get(ctrl.userReport)
    }
}

module.exports = AdminRoutes();