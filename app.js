'use strict'
require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const morgan = require('morgan')
const mongoose = require('mongoose')
const helmet = require('helmet')
const glob = require('glob')
const cors = require('cors')
const { routePrefix } = require('./utils')
const authenticate = require('./utils/authenticate');
const cronFile = require('./utils/cron');
let busboy = require('connect-busboy')
    // var client = require('./utils/connection');
const db = require("mongoose");
const os = require("os");
var methodOverride = require('method-override')

const path = require('path')
const fs = require('fs')

console.log("os.hostname()", os.hostname());

//doodlews-99

let dbUri, environment, port;
// if (os.hostname().indexOf("dodole-ws-98") == 0) /*localhost*/ {
// if (os.hostname().indexOf("doodle-ws-26") == 0) /*localhost*/ {
if (os.hostname().indexOf("HP-PC") == 0) /*localhost*/ {

    dbUri = process.env.LOCAL_DB_HOST;
    environment = 'local';
    port = process.env.port;
    process.env.BASE_URL = process.env.BASE_URL;
    // ip - 172 - 31 - 37 - 22 
    // } else if (os.hostname().indexOf("ip-172-31-1-184") == 0) /*staging*/ {
} else if (os.hostname().indexOf("ip-172-31-37-22") == 0) /*staging- chanegd by firnaas on 18-02-2020*/ {
    dbUri = process.env.STAGING_DB_HOST;
    environment = 'staging';
    port = process.env.LOCAL_STAGING_PORT;
} else /*live*/ {
    dbUri = process.env.LIVE_DB_HOST;
    environment = 'live';
    port = process.env.LIVE_PORT;
}

app.enable('trust proxy')
    /* Protecting headers */
app.use(helmet())

/*** Intermediate to get files before uploading */
app.use(busboy());

/* Body parser config */
app.use(
    bodyParser.json({
        limit: '50mb'
    })
)
app.use(
    bodyParser.urlencoded({
        limit: '50mb',
        extended: true
    })
);

//Morgon
app.use(morgan('dev'));

morgan.token('body', function getId(req, res) {
    return JSON.stringify(req.body)
})
morgan.token('json', function getId(req, res) {
        return JSON.stringify(res.__morgan_body_response)
    })
    // create a write stream (in append mode)
let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

// log all requests to access.log
app.use(morgan(':method :url :body :status :json :response-time ms ', {
    stream: accessLogStream
}))

//STATIC FILE PATH
app.use('/public', express.static('public'));

// override with different headers; last one takes precedence
app.use(methodOverride('X-HTTP-Method')) //          Microsoft
app.use(methodOverride('X-HTTP-Method-Override')) // Google/GData
app.use(methodOverride('X-Method-Override')) //      IBM

/* CORS setup */
//const domain = 'https://domain.com';
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*') /* *.name.domain for production  */
    res.setHeader('Access-Control-Allow-Headers', '*')
    next()
})
app.use(cors())

/* Apply error handlers to app */
require('./utils/errorHandler')(app)

/* Log requests to console */
app.use(morgan('dev'))

console.log("dbUri------------------>>>", dbUri);

db.connect(
    dbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
    err => {
        if (err) {
            console.log(err);
        } else {
            console.log("DB connected!", dbUri);
        }
    }
);
/* Router setup */
const openRouter = express.Router() // Open routes
const apiRouter = express.Router() // Protected routes
const businessRouter = express.Router()

/* Fetch router files and apply them to our routers */
glob('./components/*', null, (err, items) => {

    items.forEach(component => {
        require(component).routes && require(component).routes(
            openRouter,
            apiRouter,
            businessRouter
        )
    })
})

apiRouter.use(authenticate.verifyToken)
businessRouter.use(authenticate.verifyBusinessToken)

app.use('/v1', openRouter)
app.use('/api/v1', apiRouter)
app.use('/api/v2', businessRouter)

cronFile();

module.exports = app