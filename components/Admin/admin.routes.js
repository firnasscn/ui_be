
function AdminRoutes() {
    let ctrl = require('./admin.controller');
    return (open, closed) => {
        closed.route('/user/adminLogin').get(ctrl.login);
        closed.route('/screens/projectImageApprove').post(ctrl.projectImageApprove);
    }
}

module.exports = AdminRoutes();