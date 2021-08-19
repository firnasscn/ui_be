module.exports = {
    error: async(res, status, message) => {
        console.log("***Error***")
            /*  return res.send({
                 status: status,
                 message: message
             }) */
        return res.status(status).json({ message: message });
    },
    badValues(res, message) {
        return res.status(400).json({ message: message });
    },
    errorInternal(error, res) {
        console.error('error occured on ' + (new Date()).toISOString());
        console.error(error);
        return res.status(500).json({ message: "Oops! Error Occured", error: error });
    },
    success(res, data, message) {
        if (!message) {
            return res.json({ message: message, data })
        } else {
            return res.json({ message, data });
        }
    },
    noAccess(res, message) {
        return res.status(203).json({ message });
    },
    successInvalid(res, message) {
        return res.status(202).json({ message });
    },
    successEmpty(res, data, message) {
        return res.status(202).json({ message, data });
    },
    message(res, status, message) {
        return res.status(status).json({ message: message });
    },
    forbiddenError(res, message) {
        return res.status(403).json({ message: message });
    },
    notAuthorized(res, message) {
        if (!message) {
            return res.status(405).json({ message: "You're not authorized" })
        } else {
            return res.status(405).json({ message: message });
        }
    },
    notFound(res, message) {
        return res.status(404).json({ message: message });
    },
    signout(res) {
        return res.status(401).json({ message: "Session Expired. Please Log in again" });
    },
    render(res, location) {
        console.log(location);
        return res.render(location);
    },

    badValuesData(res, data) {
        if (process.env.mode !== 'production') {
            return this.badValues(res, data);
        }
        return res.status(300).json({ message: 'These are the missing or empty fields', data });
    },

    downloadFile(res, fileName) {
        res.download(fileName);
    }
}