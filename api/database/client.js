const MongoClient = require("mongodb").MongoClient

const uri = "mongodb://localhost:27017/siyayyadb";

const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true})

module.exports = client;