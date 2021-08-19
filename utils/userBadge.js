require("dotenv").config();
const User = require('../components/user/user.model');
const Screens = require('../components/screens/screens.model');
const UserBadgeAnalysis = require('../components/userBadgeAnalysis/userBadgeAnalysis.model')


function userBadge() {
    const methods = {
        screenViewTracking: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId._id }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId._id,
                        screensViewed: 1
                    }
                    let response = await UserBadgeAnalysis.create(lObjUserDetails).lean()
                } else {
                    let screenViewCount = userData.screensViewed ? userData.screensViewed : 0
                    let response = await UserBadgeAnalysis.update({ userId: userId._id }, { $set: { screensViewed: screenViewCount + 1 } })
                }
            } catch (error) {
                console.log(error)
            }
        },
        screenRatingTracking: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId._id }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId._id,
                        screensRated: 1
                    }
                    let response = await UserBadgeAnalysis.create(lObjUserDetails).lean()
                } else {
                    let screensRatedCount = userData.screensRated ? userData.screensRated : 0
                    let response = await UserBadgeAnalysis.update({ userId: userId._id }, { $set: { screensRated: screensRatedCount + 1 } })
                }
            } catch (error) {
                console.log(error)
            }
        },
        screenRatingReceived: async (userId) => {
            try {
                console.log('screenRatingReceived userId ' + userId._id)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId._id }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId,
                        ratingsReceived: 1
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails);
                }
                else {
                    let ratingReceivedCount = userData.ratingsReceived ? userData.ratingsReceived : 0;
                    await UserBadgeAnalysis.update({ userId: userId._id }, { $set: { ratingsReceived: ratingReceivedCount + 1 } })
                }
            } catch (error) {
                console.log(error);
            }
        },
        screenCommentsReceived: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId._id }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId,
                        commentsReceived: 1
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails).lean()
                } else {
                    let commentsReceivedCount = userData.commentsReceived ? userData.commentsReceived : 0;
                    await UserBadgeAnalysis.update({ userId: userId._id }, { $set: { commentsReceived: commentsReceivedCount + 1 } });
                }

            } catch (error) {
                console.log(error)
            }
        },
        screenCommentsTracking: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId,
                        screensCommented: 1
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails).lean()
                } else {
                    let commentsPostedCount = userData.screensCommented ? userData.screensCommented : 0;
                    await UserBadgeAnalysis.update({ userId: userId }, { $set: { screensCommented: commentsPostedCount + 1 } })
                }
            } catch (error) {
                console.log(error);
            }
        },
        abTestingParticipated: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId,
                        ABTestingArticipated: 1
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails).lean()
                } else {
                    let abTestingParticipatedCount = userData.ABTestingArticipated ? userData.ABTestingArticipated : 0;
                    await UserBadgeAnalysis.update({ userId: userId }, { $set: { ABTestingArticipated: abTestingParticipatedCount + 1 } })
                }
            } catch (error) {
                console.log(error)
            }
        },
        focusGroupPrticipated: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId }).lean()
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId,
                        focusGroupParticipated: 1
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails);
                } else {
                    console.log(userData.focusGroupParticipated, 'count of FG Participated')
                    let focusGroupCount = userData.focusGroupParticipated ? userData.focusGroupParticipated : 0;
                    await UserBadgeAnalysis.update({ userId: userId }, { $set: { focusGroupParticipated: focusGroupCount + 1 } })
                }
            } catch (error) {
                console.log(error);
            }
        },
        screenPublishedTracking: async (userId) => {
            try {
                console.log('userId ' + userId)
                let userData = await UserBadgeAnalysis.findOne({ userId: userId }).lean();
                if (userData == null) {
                    let lObjUserDetails = {
                        userId: userId,
                        screensPublished: 1
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails).lean();
                } else {
                    let screenPublishedCount = userData.screensPublished ? userData.screensPublished : 0;
                    await UserBadgeAnalysis.update({ userId: userId }, { $set: { screensPublished: screenPublishedCount + 1 } })
                }
            } catch (error) {
                console.log(error);
            }
        },
        avgRatingReceived: async (userId) => {
            try {
                console.log('userId ' + userId._id)
                let screenCount = await Screens.find({ userId: userId._id }).count();
                let ratingCount = await Screens.aggregate([
                    { $match: { userId: userId._id } },
                    { $lookup: { from: 'screenratings', localField: '_id', foreignField: 'screenId', as: 'screenratings' } },
                    { $unwind: '$screenratings' },
                    {
                        $group: {
                            _id: '',
                            count: { $sum: 1 }
                        }
                    }
                ])
                console.log(ratingCount[0])
                let avgRating = parseFloat(parseFloat(ratingCount[0].count) / parseFloat(screenCount)).toFixed(3);

                let userData = await UserBadgeAnalysis.findOne({ userId: userId._id }).lean()
                if (userData == null) {
                    lObjUserDetails = {
                        userId: userId._id,
                        avgRatingReceived: avgRating
                    }
                    await UserBadgeAnalysis.create(lObjUserDetails);
                } else {
                    await UserBadgeAnalysis.update({ userId: userId }, { $set: { avgRatingReceived: avgRating } });
                }
            } catch (error) {
                console.log(error);
            }
        }

    }
    return Object.freeze(methods)
}

module.exports = userBadge()
