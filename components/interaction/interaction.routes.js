function interactionComponentRoutes() {
    const ctrl = require('./interaction.controller');

    return (open, closed) => {
        closed.route('/interactions').post(ctrl.addInteraction);
        closed.route('/interactions/remove/:id').delete(ctrl.removeInteraction);
        closed.route('/interactions/remove/all/:screenId').delete(ctrl.removeAllInteractions);
        closed.route('/interactions/:screenId').get(ctrl.getInteractions);
        open.route('/interactions/listScreen/:focusgroupId').get(ctrl.listFGScreenWithVersion);
        closed.route('/interactions/update/:id').patch(ctrl.updateInteraction);
    }
}

module.exports = interactionComponentRoutes()