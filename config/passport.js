const LocalStrategy = require('passport-local').Strategy;// import local strategy middlware module
let User = require('../models/user.schema');//accessing user deetails from user.schema.js
var FacebookStrategy = require('passport-facebook').Strategy;
var config = require('../config/oauth');

module.exports = function(passport){
      //determines which information on the user object should be stored in our application's session
    passport.serializeUser(function(user, done) {// used to serialize the user for the session
        done(null, user.id); //passport then stores the value it passed on the session, 
       });
    passport.deserializeUser(function(id, done) {  // used to deserialize the user
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });
    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
  
  
    function(req, email, password, done) {

     process.nextTick(function() {
   User.findOne({ 'email' :  email }, function(err, user) {  // find a user whose email is the same as the forms email   
        if (err) // if there are any errors, return the error
            return done(err);
        if (user) {  // check to see if theres already a user with that email
            return done(null, false, {message :'That email is already taken. '});
        } else {  // if there is no user with that email   
            var newUser  = new User();// create the user
            newUser.email  = email; // set the user's local credentials
            newUser.password = newUser.generateHash(password);
            newUser.save(function(err) {// save the user
                if (err)
                    throw err;
                return done(null, newUser);
    });
}

});    

});

}));

passport.use('local-login', new LocalStrategy({
            usernameField : 'email',
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) { // callback with email and password from our form

       User.findOne({ 'email' :  email }, function(err, user) {  // find a user whose email is the same as the forms email
            if (err)// if there are any errors
                return done(err); // return the error before anything else
            console.log("user",user);
            console.log("password",password);         
          if (!user)  // if no user is found, return the message
                return done(null, false, req.flash('loginMessage', 'No user found.')); // flashdata using connect-flash
            if (!user.validPassword(password)) // if the user is found but the password is wrong
                return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata
            return done(null, user); // no error, return successful user
        });
     }));

     // =----------------------- facebook config
passport.use(new FacebookStrategy({
    clientID: config.facebook.clientID,
    clientSecret: config.facebook.clientSecret,
    callbackURL: config.facebook.callbackURL,
    profileFields : ['id','emails','name'], // gives profile.id .name .emails
    passReqToCallback:true //check if user is logged in or not
    },
    //facebook will send back token and profile
    function(req, token, refreshToken, profile, done) {
      //asynchronnous
        process.nextTick(function () {
            if (!req.user){
            User.findOne({'facebook.id':profile.id}, function(err, user){
                if (err)
                    return done(err);
                if (user){    
                    //user already exist but no token
                if(!user.facebook.token) {
                user.facebook.token = accessToken; //save token provided by fb
                user.facebook.name = profile.name.givenName+''+profile.name.familyName;//see how many names are returnedd
                user.facebook.email = profile.emails[0].value; //facebook can return multiple emails, take only one

                user.save(function(err){
                    if (err) throw err;
                    return done(null, user);
                });
            }
            return done(null, user); //user found, return that user
        }else { //if there is no user, create
            var newUser = new User()
            newUser.facebook.id = profile.id;
            newUser.facebook.token = token; //save token provided by fb
            newUser.facebook.name = profile.name.givenName+''+profile.name.familyName;//see how many names are returnedd
            newUser.facebook.email = profile.emails[0].value; //facebook can return multiple emails, take only one

            newUser.save(function(err){
                if (err) throw err;
                return done(null, newUser);
            });
        }
      });

    } else { //user already exists and is logged in, we have to link accounts
        var user = req.user; //pull user out of session
        user.facebook.id = profile.id;
        user.facebook.token = accessToken; //save token provided by fb
        user.facebook.name = profile.name.givenName+''+profile.name.familyName;//see how many names are returnedd
        user.facebook.email = profile.emails[0].value; //facebook can return multiple emails, take only one

        user.save(function(err){
            if (err) throw err;
            return done(null, user);
    });
    }
 });
}));



} //module,export
