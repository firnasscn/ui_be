const errorLog = require('../components/errorLogging/errorLogging.model')

module.exports = {
    errorLogging: async(request, response, err) => {
        let userId = request.user._id;
        let path = request.originalUrl;
        let error = err;

        await errorLog.create({
            userId: userId,
            requestPath: path,
            resposne: error
        })


    }
}