const CronJob = require('cron').CronJob;
const chatEmail = require('../components/chat/chat.controller');
const hotSpotEmail = require('../components/hotspot/hotspot.controller');
const paymentTeam = require('../components/team/team.controller');
const ratingEmail = require('../components/ratings/ratings.controller')
const report = require('../components/adminReport/adminReport.controller');
const fs = require('fs');
const filename = 'doodleflow-usage-report.xlsx';

function cronHandler() {
    // new CronJob(
    //     '0 */20 * * * *',
    //     async function() {
    //         console.log('You will see this message every second');
    //         chatEmail.listOfChats();
    //         hotSpotEmail.listOfOnScreenComments();
    //         ratingEmail.listOfRatings();
    //     },
    //     null,
    //     true
    // )

    // new CronJob(
    //     '0 0 */24 * * *',
    //     async function() {
    //         console.log('You will see this message every second');
    //         paymentTeam.paymentDueMailFunction();
    //     },
    //     null,
    //     true
    // )

    new CronJob(
        '00 00 00 * * 1',
        async function() {
            console.log('You will see this message every second');
            if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
            }
        },
        null,
        true
    )

    new CronJob(
        '0 0 */24 * * *',
        async function() {
            console.log('You will see this message every 24 hours');
            hotSpotEmail.dueDateNotification();
        },
        null,
        true
    )

    new CronJob(
        '0 0 20 * * *',
        async function() {
            console.log('You will see this message every second');
            report.userReport();
        },
        null,
        true
    )
}

module.exports = cronHandler;