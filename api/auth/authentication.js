

//token verification
module.exports = function (req, res, next) {

    if(req.cookies.id == undefined){
        res.redirect("/");
    }else {
        next();
    }

}