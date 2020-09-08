const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();
const formidable = require("formidable");
const client = require("../database/client");
const respond = require("../response");
const { throws } = require("assert");
const { json } = require("express");
const uuidv4 = require('uuid');
const ObjectId = require("mongodb").ObjectID;

client.connect((err) => {
    if (err) throw err;

    const db = client.db("siyayyadb");
    const users = db.collection("users");
    const products = db.collection("products");


    router.get("/", (req, res) => {
        var query = req.query,
            q = query['search'] || query['category']
        limit = query['limit'] || 1000;
        q = q.replace("\"", "")

        if (query['search'] != undefined) {

            searchCollection = q.split(/\s+/)
            searchData = [];
            iterator = 0;


            if (q == 'top') {
                products.find().sort({ 'lastUpdate': -1 }).limit(parseInt(limit)).toArray((err, documents) => {
                    if (err) throws

                    if (documents != null)
                        documents.forEach(document => {
                            if (!searchData.includes(document))
                                searchData.push(document)
                        });
                    if (searchData.length <= 0) {
                        return respond(res, {
                            statusCode: 404,
                            message: "Search not found",
                            result: err,
                        });
                    } else {
                        return respond(res, {
                            statusCode: 200,
                            message: searchData.length + " items found",
                            result: searchData,
                        });
                    }
                });

            } else {
                searchCollection.forEach(searchQ => {

                    iterator = iterator + 1;
                    projection = [
                        { 'title': new RegExp(searchQ) },
                        { 'category': new RegExp(searchQ) },
                        { 'subcategory': new RegExp(searchQ) },
                        { 'price': parseInt(searchQ) },
                        { 'condition': new RegExp(searchQ) },
                        { 'region': new RegExp(searchQ) },
                        { 'brand': new RegExp(searchQ) },
                        { 'shortDescription': new RegExp(searchQ) },
                        { 'fullDescription': new RegExp(searchQ) }
                    ]
                    products.find({ "$or": projection }).limit(parseInt(limit)).sort({ 'lastUpdate': -1 }).toArray((err, documents) => {
                        if (err) throws

                        if (documents != null)
                            documents.forEach(document => {
                                if (!searchData.includes(document))
                                    searchData.push(document)
                            });

                        if (iterator >= searchCollection.length)
                            if (searchData.length <= 0) {
                                return respond(res, {
                                    statusCode: 404,
                                    message: "Search not found",
                                    result: err,
                                });
                            } else {
                                return respond(res, {
                                    statusCode: 200,
                                    message: searchData.length + " items found",
                                    result: searchData,
                                });
                            }
                    })
                });
            }
        }
        else {
            products.find({ "category": q }).sort({ 'lastUpdate': -1 }).toArray((err, result) => {
                if (err) throws
                if (result == null)
                    return respond(res, {
                        statusCode: 404,
                        message: "Product not found",
                        result: err,
                    });

                return respond(res, {
                    statusCode: 200,
                    message: "found",
                    result: result,
                });
            })
        }
    });

    router.post("/upload", (req, res) => {

        const form = formidable({ multiples: true })

        form.parse(req, (err, fields) => {

            const images = fields.products
            var productDump = [];
            var productBase = [];

            if (fields.uid != undefined && fields.uid != null) {

                //preparing files for upload;
                if (images[0] != null) {
                    for (let i = 0; i < images.length; i++) {
                        if (images[i] != null)
                            productDump.push(images[i])
                    }
                }
                delete fields.products

                if (fields.uid != null && fields.title != null && fields.category != null && fields.subCategory != null && fields.price > 0 && fields.region != null && fields.shortDescription != null && fields.fullDescription != null && productDump.length > 0) {

                    users.findOne({ _id: new ObjectId(fields.uid) }, (err, user) => {
                        if (err) throws
                        if (user == null)
                            return respond(res, {
                                statusCode: 404,
                                message: "User not found",
                                result: err,
                            });


                        const productObject = {
                            ownerid: new ObjectId(user._id),
                            title: fields.title,
                            shortDescription: fields.shortDescription,
                            fullDescription: fields.fullDescription,
                            category: fields.category,
                            subCategory: fields.subCategory,
                            price: parseInt(fields.price),
                            condition: fields.condition,
                            negotiable: fields.negotiable,
                            warranty: fields.warranty,
                            region: fields.region,
                            status: 'IA',
                            brand: fields.brand,
                            product: productBase,
                            alternativeNumber: fields.alternativeNumber,
                            lastUpdate: new Date().toLocaleString(),
                            dateAdded: new Date().toLocaleString()
                        }


                        const productPath = "./products/" + user._id
                        fs.mkdir(productPath, err => {
                            if (err) throws
                            //upload all files to products path
                            if (productDump.length > 0) {
                                for (let i = 0; i < productDump.length; i++) {

                                    var realImage = Buffer.from(productDump[i], "base64");
                                    var filename = uuidv4.v4().toString() + ".jpg";
                                    productBase.push("/product/picture?pid=" + filename + "&uid=" + user._id);

                                    fs.writeFile(productPath + "/" + filename, realImage, function (err) {
                                        if (err) throws
                                        productObject.product = productBase
                                    });
                                }
                            }
                            products.insertOne(productObject, (err, result) => {
                                if (err || result == null) {
                                    return respond(res, {
                                        statusCode: 500,
                                        message: "Unable to upload product",
                                        result: err,
                                    });
                                };
                                return respond(res, {
                                    statusCode: 200,
                                    message: "Success",
                                    result: result,
                                });

                            })
                        })
                    }
                    )
                } else {
                    return respond(res, {
                        statusCode: 400,
                        message: "Validation Failed",
                    });
                }
            } else {
                respond(res, {
                    statusCode: 406,
                    message: "Authentication Failed",
                });
            }
        });

    });


    router.patch("/delete", (req, res) => {
        if (req.cookies.id != undefined) {
            users.findOne({ _id: new ObjectId(req.cookies.id) }, (err, result) => {
                if (err || result == null) return res.status(404).clearCookie("token").end();

                const form = formidable.IncomingForm()
                form.parse(req, (err, fields) => {
                    if (err) theows
                    products.findOne({ _id: new ObjectId(fields.id) }, (err, result) => {
                        if (err) throws
                        if (result == null)
                            return respond(res, {
                                statusCode: 404,
                                message: "Product not found",
                                result: err,
                            });


                        var productDump = result.product
                        products.deleteOne({ _id: new ObjectId(fields.id) }, (err) => {
                            if (err) throws
                            for (let i = 0; i < productDump.length; i++) {
                                let productPath = "./products/" + result._id + "/" + productDump[i];
                                fs.unlink(productPath, (err) => {
                                    if (err) throws
                                })
                            }
                            respond(res, {
                                statusCode: 200,
                                message: "Success",
                                result: result,
                            });

                        });

                    });

                });
            });

        } else {
            respond(res, {
                statusCode: 406,
                message: "Authentication Failed",
            });
        }
    });

    // Get profile Picture
    router.get("/picture/", (req, res) => {
        var query = req.query,
            pid = query['pid']
            uid = query['uid'];

        res.sendFile(path.join(path.dirname(require.main.filename), "/products/"+uid, pid));
    });


});

module.exports = router;
