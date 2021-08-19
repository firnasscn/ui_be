require("dotenv").config();

const Joi = require('joi');
const Response = require('../../utils/response');
const PaymentPlan = require('../paymentPlan/paymentPlan.model')
const Payment = require('./payment.model')
const PaymentHistory = require('../paymentHistory/paymentHistory.model');
const moment = require('moment');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const _ = require('lodash');
const Razorpay = require("razorpay")
const stripe = require("stripe")('sk_test_3G3Q1W0zfHSNYyk6ebJ0lzF5000wPqrDdL');

let gIntDataPerPage = 10;
var instance = new Razorpay({
    key_id: `${process.env.KEY_ID}`,
    key_secret: `${process.env.KEY_SECRET}`,
})

function paymentComponentCtrl() {
    const methods = {
        /**
         * Create Focus Group
         */
        createNewOrder: async (req, res) => {
            try {
                const schema = Joi.object().keys({
                    planId: Joi.string().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjPlanData = await PaymentPlan.findOne({ _id: ObjectId(req.body.planId) }).lean()

                let lObjPaymentData = {
                    userId: req.user._id,
                    planId: lObjPlanData._id,
                    amount: lObjPlanData.amount,
                    expiryDate: moment().add(1, 'month').format()
                }
                let lObjPayment = await PaymentHistory.create(lObjPaymentData)
                req.body.historyId = lObjPayment._id
                let amount = lObjPlanData.amount, currency = 'INR', receipt = lObjPayment._id.toString(), payment_capture = true;
                let paymentDetails = instance.orders.create({ amount, currency, receipt, payment_capture })
                paymentDetails.then((result) => {
                    console.log(result.id, "****", req.body.historyId)
                    PaymentHistory.findOneAndUpdate({ _id: ObjectId(req.body.historyId) }, { $set: { orderId: result.id } }, {
                        new: true
                    }).then(console.log).catch(console.error)

                    return Response.success(res, result, 'Order created succesfully');
                }).catch((err) => {
                    return Response.forbiddenError(res, err, 'Problem in creating order');
                })

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        addPlan: async (req, res) => {
            try {
                let paymentDetails = await PaymentPlan.create({ name: req.body.name, amount: req.body.amount, description: req.body.description })
                if (paymentDetails) {
                    return Response.success(res, paymentDetails, 'Payment plan created succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        listPaymentPlan: async (req, res) => {
            try {
                let paymentDetails = await PaymentPlan.find({}).lean()
                if (paymentDetails) {
                    return Response.success(res, paymentDetails, 'Payment plan listed succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        userPlan: async (req, res) => {
            try {
                let lObjPayment = await PaymentHistory.find(req.user._id)
                lObjPayment = lObjPayment[0] ? lObjPayment[0] : {}
                return Response.success(res, lObjPayment, 'Payment plan listed succesfully');

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        updatePaymentStatus: async (req, res) => {
            try {
                // let transferId = req.body.paymentId
                let orderId = req.body.orderId
                let paymentDetails = instance.orders.fetchPayments(orderId)
                paymentDetails.then((result) => {
                    console.log(req.body.paymentId)
                    let paymet = result.items[0].id
                    if (paymet == req.body.paymentId) {
                        PaymentHistory.update({ orderId: req.body.orderId }, { $set: { status: 1 } }, {
                            new: true
                        }).then(console.log).catch(console.error)
                        return Response.success(res, result.items, 'Plan activated succesfully');
                    } else {
                        return Response.success(res, result, 'Plan activated succesfully');
                    }

                }).catch((err) => {
                    return Response.forbiddenError(res, err, 'Problem in creating plan');
                })
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        createPayment: async (req, res) => {
            try {
                await stripe.customers.create({
                    email: req.body.email,
                    source: req.body.token
                })
                    .then((customer) => {
                        stripe.subscriptions.create({
                            customer: customer.id,
                            items: [{ plan: req.body.planId }]
                        })
                    })
                    .then((charge) => {
                        return Response.success(res, charge, 'Payment created successfully')
                    })
                    .catch(err => {
                        return Response.errorInternal(err, res)
                    });
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        createPlan: async (req, res) => {
            try {
                let product = await stripe.products.create({
                    name: req.body.name,
                    type: 'service',
                })

                let plan = await stripe.plans.create({
                    product: product.id,
                    nickname: req.body.description,
                    currency: 'usd',
                    interval: 'month',
                    amount: req.body.amount
                })

                let paymentDetails = await PaymentPlan.create({ name: req.body.name, amount: req.body.amount, description: req.body.description, planId: plan.id, productId: product.id, membersCount: req.body.membersCount, focusGroupCount: req.body.focusGroupCount, abTestingCount: req.body.abTestingCount })

                return Response.success(res, paymentDetails, 'Plan created successfully')

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        listPlan: async (req, res) => {
            try {
                let listPlan = await PaymentPlan.find({});
                return Response.success(res, listPlan, 'Payment Plans')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = paymentComponentCtrl()
