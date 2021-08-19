require("dotenv").config();

//Pusher Configuration
const Pusher = require('pusher')

const pusher = new Pusher({
    appId: '768901',
    key: '9a0697a15e678938dd64',
    secret: '0853d082b3550e2cabfa',
    cluster: 'ap2',
    encrypted: false,
});


function pusherNotification() {
    console.log("pusherNotification");
    const methods = {
        sendNotification: async(channels, data) => {
            pusher.trigger(channels, 'my-notification', data);
        },
        chatSocket: async(channels, data) => {
            console.log(channels, data)
            pusher.trigger(channels, 'addComment', data);
        },
        activitySocket: async(channels, data) => {
            pusher.trigger(channels, 'activity', data);
        },
        inspireActivity: async(channels, data) => {
            pusher.trigger(channels, 'inspireScreen', data);
        },
        onScreenComment: async(channels, data) => {
            pusher.trigger(channels, 'on-screen-comment', data);
        },
        sendratings: async(channels, data) => {
            pusher.trigger(channels, 'addRating', data)
        },
        postratings: async(channels, data) => {
            pusher.trigger(channels, 'postRating', data)
        },
        addComment: async(channels, data) => {
            console.log("sendratings", data);
            console.log(channels, "channels")
            pusher.trigger(channels, 'postComment', data)
        },
        votingSocket: async(channels, data) => {
            console.log("sendratings", data);
            console.log(channels, "channels")
            pusher.trigger(channels, 'voting-testing', data)
        },
        authenticate: async(socketId, channels, data) => {
            try {
                var resultData = await pusher.authenticate(socketId, channels, data);
                console.log(resultData)
                return resultData
            } catch (err) {
                console.log(err)
            }

        }
    }
    return Object.freeze(methods)
}

module.exports = pusherNotification()