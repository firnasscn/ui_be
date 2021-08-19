function projectComponentRoutes() {
    const ctrl = require('./project.controller')
    const { routePrefix } = require('../../utils')

    return (open, closed) => {
        closed.route('/project/createNew').post(ctrl.createNewProject)
        closed.route('/project/detail/:projectId').get(ctrl.editProject)
        closed.route('/project/list').get(ctrl.listProject)
        closed.route('/project/allProjects').get(ctrl.getAllProject)
        closed.route('/project/edit/:projectId').patch(ctrl.updateProject)
        closed.route('/project/deleteProject/:projectId').delete(ctrl.deleteProject)
        open.route('/project/industry').get(ctrl.industry)
        open.route('/project/industry').post(ctrl.insertIndustry)
        closed.route('/projects/getScreensById/:projectId').get(ctrl.getProjectScreensById)

        closed.route('/projects/getScreenImages').get(ctrl.getScreenImages)
        closed.route('/projects/createNew').post(ctrl.createNewProject)
            // closed.route('/projects/getAllProjects').get(ctrl.getAllProjects)
        closed.route('/projects/updateProject/:projectId').patch(ctrl.updateMyProject)
        closed.route('/projects/addScreen').post(ctrl.addScreenToProject)
            // closed.route('/projects/getScreens').get(ctrl.getProjectScreens)
        closed.route('/projects/listOfTools').get(ctrl.listOfTools)
        closed.route('/projects/removeScreen').delete(ctrl.removeScreen)
        closed.route('/projects/listOfFonts').get(ctrl.listOfFonts)
        closed.route('/projects/nameList').get(ctrl.getProjectsList)
        open.route('/test/projects/getAllProjects').get(ctrl.getAllProjects)

        closed.route('/projects/createProject').post(ctrl.createProject)
        closed.route('/projects/updateProjectDetails').patch(ctrl.updateProjectDetails)
        closed.route('/projects/getScreens').get(ctrl.getScreensById)
        closed.route('/projects/getScreenVersionById').get(ctrl.getScreenVersionById)
        closed.route('/projects/getFGList').get(ctrl.getFGList)

        closed.route('/projects/addColour').post(ctrl.storeColour)
        closed.route('/projects/getStyleGuideById/:projectId').get(ctrl.getStyleGuideById)
            // closed.route('/project/getAllStyleGuide/:projectid').get(ctrl.getAllStyleGuide)
            // closed.route('/project/updateStyleGuide').post(ctrl.updateStyleGuide)
        closed.route('/projects/deleteStyleGuide').delete(ctrl.deleteStyleGuide)
    }
}

module.exports = projectComponentRoutes()