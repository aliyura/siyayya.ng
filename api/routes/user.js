// Note that we are using the user's E-Mail address as their ID

const fs = require("fs");
const path = require("path");
const express = require('express');
const router = express.Router();
const formidable = require("formidable");
const bcrypt = require("bcrypt");
const uuidv4 = require('uuid');
const ObjectId = require("mongodb").ObjectID;

const respond = require("../response");
const hashCount = require("../hash/crypt");
const client = require("../database/client");
const tokenGenerator = require("../tools/tokenGenerator");

const authorizeAndSendUserData = (res, usersCollection, result) => {
    res.status(200);
    res.cookie("id", result._id);
    res.json(result);
    res.end();
    usersCollection.updateOne({ _id: new ObjectId(result._id) }, { $set: { lastLogin: new Date().toLocaleDateString("en-GB") } });
}

client.connect(err => {
    if (err) throw err;

    // Create a variable for handling database functionality i.e for Authentication, Updating information etc...
    const users = client.db("siyayyadb").collection("users");

    router.post("/signup", (req, res) => {
        const form = new formidable.IncomingForm();

        // Parse the incoming data for registration
        form.parse(req, (err, fields, fiels) => {
            // Check if all required fields ara available
            if (!fields.mobile && !fields.password && !fields.role && !fields.name) {
                respond(res, {
                    statusCode: 406,
                    message: "Validation Failed"
                });
                return;
            }
            users.findOne({ mobile: fields.mobile }, (err, result) => {
                if (err) {
                    respond(res, {
                        statusCode: 406,
                        message: "Something went wrong"
                    });
                    return;
                }
                if (result == null) {
                    // Start the registration process by hashing the password first
                    bcrypt.hash(fields.password, hashCount, (err, encrypted) => {
                        if (err) {
                            respond(res, {
                                statusCode: 406,
                                message: "Unable to create user"
                            });
                            return;
                        }

                        var varificationCode = Math.floor(1000 + Math.random() * 9000)
                        users.insertOne({
                            name: fields.name,
                            profilePicture: null,
                            email: null,
                            address: null,
                            confirmed: false,
                            category: fields.category,
                            password: encrypted,
                            mobile: fields.mobile,
                            varificationCode: varificationCode,
                            role: fields.role,
                            products: [],
                            lastLogin: new Date().toLocaleString(),
                            dateCreated: new Date().toLocaleString(),
                            token: null
                        }, (err, result) => {
                            if (err) {
                                console.log(err);
                                return respond(res, {
                                    statusCode: 406,
                                    message: "Unable to create user"
                                });
                            }
                            respond(res, {
                                statusCode: 200,
                                message: "Success",
                                result: result.ops
                            });
                        });

                    });
                } else {
                    respond(res, {
                        statusCode: 406,
                        message: "User already exist",
                        result: "Exist"
                    });
                }
            });
        });
    });


    router.post("/verify", (req, res) => {
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields, fiels) => {
            // Check if all required fields ara available
            if (!fields.code) {
                respond(res, {
                    statusCode: 406,
                    message: "Validation Failed"
                });
                return;
            }
            users.findOne({ "$and": [{ varificationCode: parseInt(fields.code) }, { mobile: fields.mobile }] }, (err, result) => {
                if (err)
                    return respond(res, {
                        statusCode: 406,
                        message: "Something went wrong",
                        result: err
                    });

                if (result != null) {
                    users.updateOne({ _id: new Object(result._id) }, { $set: { varificationCode: 1 } }).then((obj) => {
                        return respond(res, {
                            statusCode: 200,
                            message: "found",
                            result: result
                        });
                    })
                        .catch((err) => {
                            return respond(res, {
                                statusCode: 406,
                                message: "Something went wrong",
                                result: err
                            });
                        })

                } else {
                    return respond(res, {
                        statusCode: 404,
                        message: "User not found",
                        result: result
                    });
                }
            });
        });
    });

    router.post("/resend", (req, res) => {
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields) => {
            // Check if all required fields ara available
            if (!fields.mobile) {
                return respond(res, {
                    statusCode: 406,
                    message: "Validation Failed"
                });
            }
            users.findOne({ mobile: fields.mobile }, (err, result) => {
                if (err)
                    return respond(res, {
                        statusCode: 406,
                        message: "Something went wrong",
                        result: err
                    });

                var varificationCode = Math.floor(1000 + Math.random() * 9000)
                if (result != null) {
                    users.updateOne({ _id: new Object(result._id) }, { $set: { varificationCode: varificationCode } }).then((obj) => {
                        return respond(res, {
                            statusCode: 200,
                            message: "sent",
                            result: result
                        });
                    }).catch((err) => {
                        return respond(res, {
                            statusCode: 406,
                            message: "Something went wrong",
                            result: err
                        });
                    })
                } else {
                    return respond(res, {
                        statusCode: 404,
                        message: "User not found",
                        result: result
                    });
                }

            });
        });
    });


    router.post("/signin", (req, res) => {
        const form = new formidable.IncomingForm();

        if (req.cookies.token) {
            users.findOne({ token: req.cookies.token }, (err, result) => {
                if (err || result == null) return res.status(404).clearCookie("token").end();
                delete result.password

                if (result.token == req.cookies.token) {
                    return authorizeAndSendUserData(res, users, result);
                } else {
                    respond(res, {
                        statusCode: 406,
                        message: "Session expired",
                        result: err
                    });
                }
            });
            return;
        } else {
            // Parse the incoming data for comparison
            form.parse(req, (err, fields, files) => {
                if (err) {
                    return respond(res, {
                        statusCode: 406,
                        message: "Something went wrong",
                        result: err
                    });

                }

                if (fields.mobile && fields.password) {
                    users.findOne({ mobile: fields.mobile }, (err, result) => {
                        if (err) {
                            return respond(res, {
                                statusCode: 406,
                                message: "Something went wrong",
                                result: err
                            });
                        }
                        if (result != null) {

                            bcrypt.compare(fields.password, result.password, (err, validated) => {
                                if (err)
                                    return respond(res, {
                                        statusCode: 406,
                                        message: "Password not match",
                                        result: err
                                    });



                                let token = tokenGenerator(12);

                                users.updateOne({ _id: new ObjectId(result._id) }, { $set: { token: token } }, err => {
                                    if (err) return respond(res, {
                                        statusCode: 406,
                                        message: "Something went wrong",
                                        result: err
                                    });

                                    delete result.password;
                                    authorizeAndSendUserData(res, users, result);
                                });

                            });
                        } else {
                            respond(res, {
                                statusCode: 404,
                                message: "User not found",
                                result: result
                            });
                        }
                    });
                } else {
                    respond(res, {
                        statusCode: 401,
                        message: "Validation Failed",
                        result: {}
                    });
                }
            })
        }

    });

    router.post("/signout", (req, res) => {
        if (req.cookies.id != undefined) {
            res.clearCookie("id").clearCookie("token");
            respond(res, {
                statusCode: 200,
                message: "Success",
                result: {
                    session: "cleared"
                }
            });
        } else {
            respond(res, {
                statusCode: 404,
                message: "Session not found",
                result: {
                    session: "notAvailable"
                }
            });
        }
        res.end();
    });

    router.patch("/update", (req, res) => {
        const form = new formidable.IncomingForm();

        form.parse(req, (err, fields) => {
            if (err) {
                respond(res, {
                    statusCode: 400,
                    message: "Something went wrong",
                    result: err
                });
                return;
            }

            if (fields.token == undefined) {
                return respond(res, {
                    statusCode: 401,
                    message: "Authentication Failed",
                });
            } else {



                users.findOne({ _id: new ObjectId(fields.id) }, (err, result) => {
                    if (err) {
                        return respond(res, {
                            statusCode: 400,
                            message: "Something went wrong",
                            result: err
                        });
                    }

                    if (result) {
                        //change profile pictur

                        if (fields.file != undefined && fields.file != null) {

                            const allowedExtensions = /(.jpg|\.jpeg|\.png)$/i;
                            var image = fields.file;
                            var originalName = fields.filename;
                            var realImage = Buffer.from(image, "base64");
                            var filename = result._id + ".jpg" //uuidv4.v4();


                            if (originalName.match(allowedExtensions)) {
                                fields.profilePicture = `/user/picture?id=${filename}`;
                                fs.writeFile('./profiles/' + filename, realImage, function (err) {
                                    if (err) throws
                                });
                            }


                        }







                        if (fields.file) delete fields.file
                        if (fields.filename) delete fields.filename

                        users.updateOne({ _id: new ObjectId(fields.id) }, {
                            $set: fields
                        }, (err, result) => {
                            if (err || result == null) {
                                return respond(res, {
                                    statusCode: 400,
                                    message: "Unable to update your profile",
                                    result: err
                                });
                            }
                            respond(res, {
                                statusCode: 200,
                                message: "Success",
                                result: result
                            });
                        });
                    }
                    else {
                        return respond(res, {
                            statusCode: 404,
                            message: "User not found",
                            result: err
                        });
                    }
                });
            }
        });

    });

    router.delete("/delete", (req, res) => {
        const form = formidable.IncomingForm();

        if (req.cookies.id != undefined) {
            form.parse(req, (err, fields, files) => {
                users.findOne({ _id: new ObjectId(req.cookies.id) }, (err, result) => {
                    if (err || result == null) {
                        respond(res, {
                            statusCode: 500,
                            message: "Something went wrong",
                            result: err
                        });
                        return;
                    }
                    bcrypt.compare(fields.password, result.password, (err, validated) => {
                        if (err || !validated) {
                            respond(res, {
                                statusCode: 406,
                                message: "Authentication Failed",
                                result: err
                            });
                            return;
                        }
                        users.deleteOne({ _id: new ObjectId(result._id) }, (err, result) => {
                            if (err || result == null || result.deletedCount < 1) {
                                respond(res, {
                                    statusCode: 500,
                                    message: "Unable to delete account",
                                    result: err
                                });
                                return;
                            }
                            res.clearCookie("id").clearCookie("persistentId").clearCookie("token");
                            respond(res, {
                                statusCode: 200,
                                message: "Success",
                                result: result
                            });
                        });
                    });
                });
            }
            );
        } else {
            respond(res, {
                statusCode: 406,
                message: "Authentication Failed",
            });
        }
    });

    // Get profile Picture
    router.get("/picture/", (req, res) => {
        var id = req.url.replace("/picture?id=", "").trim()
        res.sendFile(path.join(path.dirname(require.main.filename), "/profiles/", id));
    });

})
module.exports = router;