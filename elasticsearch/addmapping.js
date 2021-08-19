const esClient = require('./client');
const addmappingToIndex = async function (indexName, mappingType, mapping) {
    console.log("Creating Mapping index");
    esClient.indices.putMapping({
        index: indexName,
        include_type_name: true,
        type: mappingType,
        body: mapping
    }, (err, resp, status) => {
        if (err) {
            console.error(err, status);
        }
        else {
            console.log('Successfully Created Mapping', status, resp);
        }
    });
}

module.exports = addmappingToIndex;

// test function to explain how to invoke.
async function test() {
    const mapping = {
        properties: {
            screenId: {
                type: "keyword"
            },
            screenName: {
                type: "text"
            },
            viewCount : {
                type : "long"
            },
            screenType: {
                type: "object"
            },
            tags: {
                type: "object"
            },
            isPublish: {
                type: "boolean"
            },
            image: {
                type: "text"
            },
            projectId: {
                type: "object"
            },
            userId: {
                type: "object"
            },
            type: {
                type: "text"
            },
            screenStatus: {
                type: "long"
            }
        }
    }
    try {
        const resp = await addmappingToIndex('screenss', 'screens', mapping);
        console.log(resp);
    } catch (e) {
        console.log(e);
    }
}


test();