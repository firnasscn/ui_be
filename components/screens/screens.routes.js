require("dotenv").config();

function componentOneRoutes() {
    const ctrl = require('./screens.controller')
    const fileUpload = require('../../utils/fileUpload')

    return (open, closed) => {

        //closed.route('/screens/upload').all(fileUpload.upload.array('screens')).post(ctrl.uploadScreenImages)
        closed.route('/screens/focusgroup/upload/init').post(ctrl.uploadScreenImagesToFG)
        closed.route('/screens/focusgroup/upload/complete').post(ctrl.updateCompleteStatusFG)

        closed.route('/screens/project/upload/init').post(ctrl.uploadScreenImagesToProject)
        closed.route('/screens/project/upload/complete').post(ctrl.updateCompleteStatus)

        closed.route('/screens/createNew').all(ctrl.checkScreenNameExist).all(fileUpload.upload.single('screens')).post(ctrl.createNewScreen)
        closed.route('/screens').get(ctrl.listAllScreens)
        closed.route('/screens/updateScreen/:screenId').all(fileUpload.upload.single('screens')).put(ctrl.updateMyScreen)
        open.route('/screens/getMyScreenDetails/:screenId').get(ctrl.getMyScreenDetails)

        closed.route('/screens/deleteMyScreen/:screenId').delete(ctrl.deleteScreenById)
        closed.route('/screens/getUserAllScreens').get(ctrl.getUserAllScreens)
        closed.route('/screens/patchScreenDetails/:screenId').patch(ctrl.updateSpecificDetails)
        closed.route('/screens/addScreens').post(ctrl.updateImagesToFocusGroup)
        closed.route('/screens/add').post(ctrl.updateScreensToFocusGroup)
        closed.route('/screens/flag').post(ctrl.flagAsInappropriate)
        open.route('/test/screens/createNew').all(fileUpload.upload.single('screens')).post(ctrl.createNewScreen)
        closed.route('/screens/reorderFgScreens').post(ctrl.changeFGSequence)
        closed.route('/screens/reorderProjectScreens').post(ctrl.changeProjectSequence)
        closed.route('/screens/ratings/post').post(ctrl.postRatings)
        closed.route('/screens/project').all(fileUpload.upload.array('screens')).post(ctrl.uploadProjectScreens)
        closed.route('/screens/updateScreenDetails').put(ctrl.updateScreenDetails)
        closed.route('/screens/export').get(ctrl.exportImagesAsPDF)
        open.route('/screens/exportFGImagesAsPDF').get(ctrl.exportFGImagesAsPDF)
        open.route('/screens/exportToken').post(ctrl.exportToken)
        closed.route('/screens/exportTagScreens').get(ctrl.exportTagImage)
        closed.route('/screens/changeScreenName').post(ctrl.changeScreenName)
        closed.route('/screens/changeFGScreenName').post(ctrl.changeFGScreenName)
        closed.route('/screens/uploadScreens').all(fileUpload.upload.array('screens')).post(ctrl.uploadSceens);
        open.route('/screens/createPPT').get(ctrl.generatePPTFile)

        closed.route('/screens/uploadScreenVersion').all(fileUpload.upload.single('screens')).post(ctrl.uploadScreenVersion);
        open.route('/screens/listScreenVersion/:screenId').get(ctrl.listScreenVersions)
        closed.route('/screens/deleteScreenVersion').delete(ctrl.deleteScreenVersions)

        // Sketch plugin 
        closed.route('/screens/uploadScreen').all(fileUpload.upload.any('screens')).post(ctrl.uploadSketch);

    }
}

module.exports = componentOneRoutes()