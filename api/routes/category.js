const express = require("express");
const router = express.Router();
const client = require("../database/client");
const respond = require("../response");
const { throws } = require("assert");
client.connect((err) => {
    if (err) throw err;

    const db = client.db("siyayyadb");
    const productCatgeory = db.collection("product_categories");
    const businessCatgeory = db.collection("business_categories");

    router.get("/", (req, res) => {

        var query = req.query,
            q = query['type']
        q = q.replace("\"", "")

        if (q == "business")
            businessCatgeory.find().sort({ 'name': -1 }).toArray((err, result) =>  {
                if (err) throws

                if (result == null) {
                    return respond(res, {
                        statusCode: 404,
                        message: "No Category Found",
                    });
                } else {
                    return respond(res, {
                        statusCode: 200,
                        message: result.length + " items found",
                        result: result,
                    });
                }
            });
        
        else if (q == "product")
            productCatgeory.find().sort({ 'name': -1 }).toArray((err, result) =>  {
                if (err) throws

                if (result !=null) {
                    return respond(res, {
                        statusCode: 200,
                        message: result.length + " items found",
                        result: result,
                    });
                }else{
                    return respond(res, {
                        statusCode: 404,
                        message: "No Category Found",
                    });
                }
            });
        else
            return respond(res, {
                statusCode: 404,
                message: "No Category Found",
            });
    });

});

module.exports = router;
