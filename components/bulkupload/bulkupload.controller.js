const Joi = require('joi');
const Bulkupload = require('./bulkupload.model');

const Response = require('../../utils/response');
const helper = require('../../utils/s3Upload');
const Project = require('../project/project.model')
const ObjectId = require('mongoose').Types.ObjectId;
var fs = require('fs');
const path = require('path')
function categoriesComponentCtrl(model) {
  const methods = {
    /*
     * Generate Excel from bulk upload 
     */
    generateExcel: async (req, res) => {
      try {
        if (req.query.projectId) {
          console.log({ projectId: ObjectId(req.query.projectId) })
          var filesArray = await Bulkupload.find({ projectId: ObjectId(req.query.projectId) })
        } else {
          var filesArray = await Bulkupload.find({})
        }
        if (filesArray.length > 0) {
          var jsn = []
          for (let file of filesArray) {
            var jsonArray = {
              "projectNmae": file.projectName,
              "projectId": file.projectId,
              "originalfileName": file.originalFile,
              "key": file.imageKey
            }
            jsn.push(jsonArray)
          }

          var data = 'ProjectName\tProjectID\toriginalfile\timageKey\n';
          for (var i = 0; i < jsn.length; i++) {
            data = data + jsn[i].projectNmae + '\t' + jsn[i].projectId + '\t' + jsn[i].originalfileName + '\t' + jsn[i].key + '\n';
          }
          if (fs.existsSync(path.join(__dirname, `../../public/${filesArray[0].projectName}.xlsx`))) {
            fs.unlinkSync(path.join(__dirname, `../../public/${filesArray[0].projectName}.xlsx`))
          }
          let promise = new Promise((resolve, reject) => {
            fs.writeFile(path.join(__dirname, `../../public/${filesArray[0].projectName}.xlsx`), data, (err) => {
              if (err) {
                reject(err)
              } else {
                resolve("File created")
              }
            });
          })
          await promise
          let filepath = { path: `${process.env.SERVER_URL}public/${filesArray[0].projectName}.xlsx` };
          return Response.success(res, filepath, "Export link for the project");
        } else {
          return Response.success(res, "There is no screens for this project!!");
        }
      } catch (error) {
        return Response.errorInternal(error, res)
      }

    },
    checkProjectExists: async (req, res, next) => {
      try {
        let projectName = req.headers.projectname
        if (projectName) {
          let checkProjectExists = await Project.find({ projectName: projectName }).lean()
          if (checkProjectExists.length == 0) {
            let lObjInsertObj = await Project.create({
              industry: '5ce4dbaea5136039306c819d',
              projectName: projectName
            })
            req.headers.projectId = lObjInsertObj._id
            next()
          } else {
            req.headers.projectId = checkProjectExists[0]._id

            next()
          }
        } else {
          return Response.badValuesData(res, "Please enter your project name!! ")
        }
      } catch (error) {
        return Response.errorInternal(error, "Failure")
      }
    },
    storeScreenDeatils: async (req, res) => {
      try {
        console.log(req.files)
        let filesArray = req.files
        let jsonArray = []
        for (let file of filesArray) {
          let json = {
            projectName: req.headers.projectname,
            projectId: ObjectId(req.headers.projectId),
            originalFile: file.originalname,
            imageKey: file.key
          }
          jsonArray.push(json)
        }
        let createBulkUpload = await Bulkupload.insertMany(jsonArray)
        if (createBulkUpload) {
          return Response.success(res, createBulkUpload, "Uploaded Successfully!!")
        }
      } catch (error) {
        console.log(error)
        return Response.errorInternal(error, "Failure")
      }
    },
    getProjectList: async (req, res) => {
      try {
        let lAryListAllProjects = await Project.find({ projectStatus: 1 }).select('projectName');
        lAryListAllProjects = lAryListAllProjects.filter(x => {
          if (x.projectName != null)
            return x
        })
        return Response.success(res, lAryListAllProjects, 'Project lists');
      } catch (error) {
        return Response.errorInternal(error, "Failure")
      }
    },
    getProjectImages: async (req, res) => {
      try {
        if (req.query.projectId) {
          console.log({ projectId: ObjectId(req.query.projectId) })
          var filesArray = await Bulkupload.find({ projectId: ObjectId(req.query.projectId) }).lean()

          if (filesArray.length > 0) {
            for (let v of filesArray) {
              v.image = `https://d31qgkthzchm5g.cloudfront.net/${v.projectName}/` + v.imageKey
            }
            return Response.success(res, filesArray, "List of Images")
          } else {
            return Response.forbiddenError(res, "No Images Found")
          }
        } else {
          return Response.badValuesData(res, "Please select project for images")
        }
      } catch (error) {
        console.log(error)
        return Response.errorInternal(error, "Failure")
      }
    }
  }
  return Object.freeze(methods)
}

module.exports = categoriesComponentCtrl()
