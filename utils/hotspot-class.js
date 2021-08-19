const feathers = require('@feathersjs/feathers');
const configuration = require('@feathersjs/configuration');

const flowsModel = require('../models/flows.model');
const hotSpotsModel = require('../models/hotspots.model');
const { authenticate } = require('@feathersjs/authentication').hooks;
const authentication = require('@feathersjs/authentication');
const mongoose = require('mongoose');

const config = feathers().configure(configuration())

class AdminAccounts {
    constructor(options) {
        this.options = options || {};
    }

    async find(params) {
        console.log("find", params)
        try {
            let lObjFlowId = params.route.flowId;
            let lObjScreenId = params.route.screenId;
            console.log(lObjScreenId, lObjFlowId, params.payload.usersId)

            //Get hostSpot value and update
            let lAryHotSpots = await flowsModel.find({
                "hotSpots.screenId": mongoose.Types.ObjectId(lObjScreenId),
                "hotSpots.flowId": mongoose.Types.ObjectId(lObjFlowId),
                "userId": mongoose.Types.ObjectId(params.payload.usersId)
            }).select("hotSpots");
            console.log(lAryHotSpots)
            return {
                status: 200,
                message: "Hotspots list",
                data: lAryHotSpots
            };
        } catch (e) {
            console.log(e);
        }
    }
    async remove(id, params) {
        console.log(" ******* R E M O V E ******* ");
        console.log("id ==== ", id);
        console.log("params === ", params);
        let lObjFlowId = params.route.flowId;
        let lObjHotSpotId = params.query.hotSpotId;
        let res = await flowsModel.update(
            { _id: lObjFlowId },
            { $pull: { "hotSpots": { _id: lObjHotSpotId } } }
        )
        if (res)
            return {
                status: 200,
                message: "HotsSpot Removed Successfully."
            }
        else
            return {
                status: 400,
                message: res
            }
    }

    async create(data, params) {
        console.log('create Hotspot')
        try {
            console.log("data", data);
            console.log("params here is ------> ", params);
        } catch (e) {
            console.log(e);
        }
    }

    async update(id, data, params) {
        console.log('update Hotspot')
        console.log("data", data);
        console.log("params here is ------> ", params);
        try {
            let lObjFlowId = params.route.flowId;
            let lObjScreenId = params.query.screenId;

            if (!!lObjFlowId) {

                data.targetScreenId = data.targetScreenId;
                data.screenId = data.screenId;
                data.flowId = data.flowId;
                data.userId = params.payload.usersId;

                console.log("lObjFlowId", lObjFlowId);

                //Get hostSpot value and update
                let lAryHotSpots = await flowsModel.findOne({ _id: lObjFlowId }).select("hotSpots")
                console.log(lAryHotSpots, "sssssssssssssssssssssssss")
                lAryHotSpots = (!!lAryHotSpots.hotSpots) ? lAryHotSpots.hotSpots : [];
                lAryHotSpots.push(data);

                let res = await flowsModel.findByIdAndUpdate(lObjFlowId, {
                    $set: {
                        hotSpots: lAryHotSpots
                    }
                }, {
                        new: true
                    }).populate('screens', '_id images screenName').populate('contributers', '_id email name profilePicture')
                console.log("res", res)
                return res;
            }
        } catch (e) {
            console.log(e);
        }
    }
    setup(app) {
        this.app = app;
        authenticate('jwt'),
            hook => {
                console.log(hook.params.payload.usersId);
                app.hooks = hook.params;
                console.log('The User id here is ---> ', hook.params.user);
                console.log(app.hooks)
            }
    }
}

module.exports = new AdminAccounts();


