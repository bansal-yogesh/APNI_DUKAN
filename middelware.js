module.exports.loginCheck = (req,res,next)=>{
    if(req.user){
        next();
    }
    else{
        req.session.targetUrl = req.url;
        console.log(req.session.targetUrl);
        res.redirect("/user/login");
    }
}
module.exports.loginPresist = (req,res,next)=>{
    res.locals.targetUrl = req.session.targetUrl;
    next();
}