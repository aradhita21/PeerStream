
module.exports = function(app,passport){

    app.get('/',isLoggedIn,(req,res)=>{ // if app gets "/" and is logged in
    console.log("req user",req.user);// print user details
    res.render('home',{ // response by rendering to home.handlebars
        user : req.user // and give user details
    });
});

app.get('/login',(req,res) => { //if app gets "/login"
    res.render('login')// render it to login.handlebars
});

app.post('/login',passport.authenticate('local-login',{ //redirection after authentication
        successRedirect : '/', //if success, redirect to home page
        failureRedirect : '/login', // if failed, redirect back to login
        failureFlash: 'Invalid Username or password',//if success, flash invalid
        //failureFlash : true,
        successFlash : 'Welcome!' //if success, flash welcome
    }
));

app.get('/signup',(req,res) => {// if app gets "/signup"
    res.render('signup');//"response by rendering to signup.handlebars"
})

app.post('/signup', passport.authenticate('local-signup', { //register the details to local data base
    successRedirect : '/', // redirect to the secure profile section
    failureRedirect : '/signup', // redirect back to the signup page if there is an error
    failureFlash : true // allow flash messages
}));

app.get('/logout', function(req, res) { //if app gets "/logout"
    req.logout(); //logout the user
    res.redirect('/login'); // redirect to login page
});
 function isLoggedIn(req, res, next) {// route middleware to make sure a user is logged in
     if (req.isAuthenticated())// if user is authenticated in the session 
        return next(); //carry on, next is "/" to home page
     res.redirect('/login');// if they aren't redirect them to the home page
 }
};