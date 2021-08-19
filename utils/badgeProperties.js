require("dotenv").config();
const BadgeProperty = require('../components/badgeProperties/badgeProperties.model');



function badgeProperties() {
    const methods = {
        createProperties: async (screenCount, action) => {
            await methods.basicBadge(screenCount, "5d25b2950b6efd603df68eeb", action);
            await methods.noviceBadge(screenCount, "5d25b2edd7ba2c603c0df2c1", action);
            await methods.masterBadge(screenCount, "5d25b2f40b6efd603df68eec", action);
            await methods.proBadge(screenCount, "5d25b2fae186ff60361402b7", action);

            await methods.basicCriticBadge(screenCount, "5d25b3018994ec60370b0d1f", action);
            await methods.noviceCriticBadge(screenCount, "5d25b315d7ba2c603c0df2c2", action);
            await methods.masterCriticBadge(screenCount, "5d25b3210b6efd603df68eed", action);
            await methods.proCriticBadge(screenCount, "5d25b32be186ff60361402b8", action);

            await methods.basicPublisherBadge(screenCount, "5d25b3338994ec60370b0d20", action);
            await methods.novicePublisherBadge(screenCount, "5d25b33bd7ba2c603c0df2c3", action);
            await methods.masterPublisherBadge(screenCount, "5d25b3500b6efd603df68eee", action);
            await methods.proPublisherBadge(screenCount, "5d25b359e186ff60361402b9", action);

            await methods.basicLurkerBadge(screenCount, "5d25b3628994ec60370b0d21", action);
            await methods.noviceLurkerBadge(screenCount, "5d25b36fd7ba2c603c0df2c4", action);
            await methods.masterLurkerBadge(screenCount, "5d25b37a0b6efd603df68eef", action);
            await methods.proLurkerBadge(screenCount, "5d25b383e186ff60361402ba", action);
        },
        basicBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 20 / 100),
                screensCommented = Math.round(screenCount * 0.5 / 100),
                screensRated = Math.round(screenCount * 0.8 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.5 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        noviceBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 30 / 100),
                screensCommented = Math.round(screenCount * 1 / 100),
                screensRated = Math.round(screenCount * 1.2 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 1 / 100),
                ratingsReceived = Math.round(screenCount * 2.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.5 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        masterBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 40 / 100),
                screensCommented = Math.round(screenCount * 1.1 / 100),
                screensRated = Math.round(screenCount * 2 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 1.1 / 100),
                ratingsReceived = Math.round(screenCount * 30 / 100),
                avgRatingsReceived = Math.round(screenCount * 1 / 100),
                focusgroupsParticipated = Math.round(screenCount * 1.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 1.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        proBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 50 / 100),
                screensCommented = Math.round(screenCount * 5 / 100),
                screensRated = Math.round(screenCount * 5 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 2.5 / 100),
                ratingsReceived = Math.round(screenCount * 5 / 100),
                avgRatingsReceived = Math.round(screenCount * 1.5 / 100),
                focusgroupsParticipated = Math.round(screenCount * 2 / 100),
                aBTestsParticipated = Math.round(screenCount * 2 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        basicCriticBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 20 / 100),
                screensCommented = Math.round(screenCount * 1.2 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.5 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        noviceCriticBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 30 / 100),
                screensCommented = Math.round(screenCount * 1.2 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.5 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        masterCriticBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 40 / 100),
                screensCommented = Math.round(screenCount * 2.5 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.5 / 100),
                focusgroupsParticipated = Math.round(screenCount * 1.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 1.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        proCriticBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 50 / 100),
                screensCommented = Math.round(screenCount * 5 / 100),
                screensRated = Math.round(screenCount * 5 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 2 / 100),
                aBTestsParticipated = Math.round(screenCount * 2 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        basicPublisherBadge: async (screenCount, id, action) => {
            let screensViewed = 'NA',
                screensCommented = Math.round(screenCount * 1.2 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        novicePublisherBadge: async (screenCount, id, action) => {
            let screensViewed = 'NA',
                screensCommented = Math.round(screenCount * 1.2 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 1.2 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 1.2 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        masterPublisherBadge: async (screenCount, id, action) => {
            let screensViewed = 'NA',
                screensCommented = Math.round(screenCount * 1.2 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 3 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 1.2 / 100),
                ratingsReceived = Math.round(screenCount * 2.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.9 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        proPublisherBadge: async (screenCount, id, action) => {
            let screensViewed = 'NA',
                screensCommented = Math.round(screenCount * 1.2 / 100),
                screensRated = Math.round(screenCount * 2.5 / 100),
                screensPublished = Math.round(screenCount * 5 / 100),
                inspirationTime = 'NA',
                commentsReceived = Math.round(screenCount * 2.5 / 100),
                ratingsReceived = Math.round(screenCount * 5 / 100),
                avgRatingsReceived = Math.round(screenCount * 1.1 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        basicLurkerBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 20 / 100),
                screensCommented = Math.round(screenCount * 0.5 / 100),
                screensRated = Math.round(screenCount * 0.8 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        noviceLurkerBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 30 / 100),
                screensCommented = Math.round(screenCount * 0.5 / 100),
                screensRated = Math.round(screenCount * 0.8 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        masterLurkerBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 40 / 100),
                screensCommented = Math.round(screenCount * 0.5 / 100),
                screensRated = Math.round(screenCount * 0.8 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        },
        proLurkerBadge: async (screenCount, id, action) => {
            let screensViewed = Math.round(screenCount * 50 / 100),
                screensCommented = Math.round(screenCount * 0.5 / 100),
                screensRated = Math.round(screenCount * 0.8 / 100),
                screensPublished = Math.round(screenCount * 0.5 / 100),
                inspirationTime = 10,
                commentsReceived = Math.round(screenCount * 0.5 / 100),
                ratingsReceived = Math.round(screenCount * 0.5 / 100),
                avgRatingsReceived = Math.round(screenCount * 0.7 / 100),
                focusgroupsParticipated = Math.round(screenCount * 0.5 / 100),
                aBTestsParticipated = Math.round(screenCount * 0.5 / 100)
            let obj = {
                screensViewed: screensViewed,
                screensCommented: screensCommented,
                screensRated: screensRated,
                screensPublished: screensPublished,
                inspirationTime: inspirationTime,
                commentsReceived: commentsReceived,
                ratingsReceived: ratingsReceived,
                avgRatingsReceived: avgRatingsReceived,
                FocusgroupsParticipated: focusgroupsParticipated,
                ABTestsParticipated: aBTestsParticipated,
                badgeId: id
            }

            if (action == 'create') {
                let createProperty = await BadgeProperty.create(obj)
            } else {
                let updateProperty = await BadgeProperty.update({ badgeId: id }, { $set: { obj } })
            }

        }


    }
    return Object.freeze(methods)
}

module.exports = badgeProperties()


