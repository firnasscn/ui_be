var elasticsearch = require('elasticsearch'),

    // var client = new elasticsearch.Client({
    //     hosts: ['http://localhost:9200'],
    //     log: 'error'
    // });

    // module.exports = client;  
    index = "doodleblue",
    client = new elasticsearch.Client({
        host: 'localhost:9200',
        log: 'trace'
    });

module.exports.elasticSearchClient = client;

module.exports.elasticSearchConfig = {
    index: index
};