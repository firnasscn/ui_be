module.exports = {
    apps: [
        {
            name: "DoodleFlow Webapp",
            script: "./server.js",
            watch: true,
            env: {
                "PORT": 3000,
                "NODE_ENV": "development"
            },
            env_staging: {
                "PORT": 3000,
                "NODE_ENV": "staging",
                "STAGING_DB_HOST": "mongodb+srv://doodleflow:2lXqmNNMwcyqrO4z@doodleflow-staging-vdc8d.mongodb.net/doodleflow",
                "BASE_URL": "http://api.doodleflow.io/"
            },
            env_production: {
                "watch": false,
                "PORT": 2001,
                "NODE_ENV": "production",
            },
            env_uat: {
                "watch": false,
                "PORT": 2001,
                "NODE_ENV": "staging",
            }
        }
    ]
}