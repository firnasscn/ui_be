function bulkuploadComponentRoutes() {
  const ctrl = require('./bulkupload.controller')
  const fileupload = require('../../utils/screensUpload')

  return (open, closed) => {
    open.route('/home/uploadScreens').all(ctrl.checkProjectExists).all(fileupload.upload.array('files')).post(ctrl.storeScreenDeatils)
    open.route('/home/exportLink/').get(ctrl.generateExcel)
    open.route('/home/getProjectList').get(ctrl.getProjectList)
    open.route('/home/getProjectImages').get(ctrl.getProjectImages)
  }
}

module.exports = bulkuploadComponentRoutes()
