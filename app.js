const compression = require("compression");
const express = require('express');
const morgan = require('morgan');
const app = express();
const usersRoute = require('./api/routes/user');
const productRoute = require('./api/routes/product');
const categoryRoute = require('./api/routes/category');

const cookieParser = require('cookie-parser');

// Use gzip to compress everything
app.use(compression());

app.use(morgan('dev'));
app.use(cookieParser())

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});


app.use('/user', usersRoute)
app.use('/product', productRoute)
app.use('/category', categoryRoute)

module.exports = app;