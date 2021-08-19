function teamRoute() {
    let ctrl = require('./team.controller');
    return (open, closed) => {
        closed.route('/teams/createTeam').post(ctrl.createTeam)
        closed.route('/teams/assignToProjects').put(ctrl.assignToProjects)
        closed.route('/teams/removeMember').put(ctrl.removeMember)
        closed.route('/teams/teamList').get(ctrl.listTeam)
        closed.route('/teams/teamUsersList').get(ctrl.teamUsersList)
        closed.route('/teams/searchTeamuser').get(ctrl.searchTeamuser)
        closed.route('/teams/readOneTeam/:teamId').get(ctrl.readOneTeam)
        closed.route('/teams/teamMembersList/:teamId').get(ctrl.teamMembersList)
        closed.route('/teams/paymentCheckout/:teamId').get(ctrl.paymentCheckout)
        closed.route('/teams/createPaymentTeam').post(ctrl.createPaymentTeam)
        closed.route('/teams/capturePayment').post(ctrl.capturePayment)
        closed.route('/teams/addMembers').post(ctrl.addTeamMembers)
        closed.route('/teams/deleteTeamMember').post(ctrl.deleteTeamMember)
        closed.route('/teams/updateTeam').put(ctrl.updateTeam)
        closed.route('/teams/deleteTeam/:teamId').delete(ctrl.deleteTeam)
        closed.route('/teams/paymentDue').get(ctrl.paymentDueMailFunction)
        closed.route('/teams/payments').get(ctrl.getTeamPayments);
        closed.route('/teams/payments/invoice/:id').get(ctrl.downloadTeamPaymentInvoice);

        // new api for team control
        open.route('/teams/adminTeam').post(ctrl.adminCreateTeam)
    }
}

module.exports = teamRoute();