const LocalStrategy = require('passport-local').Strategy;// import local strategy middlware module
let User = require('../models/user.schema');//accessing user deetails from user.schema.js

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
  //  function(req, email, password, done) {
    
 //       process.nextTick(function() {  // User.findOne wont fire unless data is sent back
 //         User.findOne({ 'email' :  email }, function(err, user) {// see if the user trying to login already exists
            
 //           if (err) // if there are any errors, return the error
 //               return done(err);
  //          if (user) {  // check to see if theres already a user with that email
  //              return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
   //         } else {
   //             var newUser = new User(); // if there is no user with that email, create the user
    //            newUser.email    = email; // set the user's local credentials
     //           newUser.password = newUser.generateHash(password);
     //           newUser.save(function(err) { // save the user
      //              if (err)
       //                 throw err;
       //             return done(null, newUser);
       //         });
       //     }
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
}