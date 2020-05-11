const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const app = express();
const passport = require('passport');
const flash = require('connect-flash');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');

const HTTPS_PORT = 8443; //default port for https is 443
const HTTP_PORT = 8001; //default port for http is 80
var CLIENTS = [];
var CLIENTS1 = [];
var count=0;
const fs = require('fs');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
var flag=999;
 
const WebSocketServer = WebSocket.Server;
// Yes, TLS is required


require('dotenv').config();

app.engine('handlebars',exphbs({defaultLayout : 'main'}));
app.set('view engine','handlebars');

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())
//app.use(express.static('static'))

const MONGODB_URI = process.env.MONGODB_URL;

mongoose.connect(MONGODB_URI,{ useNewUrlParser : true });

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('connected');
});

app.use(session({secret : 'ilearnnodejs'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


app.use("/static", express.static('./static/'));
require('./config/passport')(passport);
require('./routes/index')(app,passport);

const serverConfig = {  //defining server configuration
  key: fs.readFileSync('key.pem'), //reading file key.pem
  cert: fs.readFileSync('cert.pem'),//reading file cert.pem
};

app.use('/user/:id', function (req, res, next) {
  app.use("/static", express.static('./static/'));
  console.log('Request webrtc:')
  next()
})
  
  app.get('/',isLoggedIn,(req,res)=>{
      console.log("req user",req.user);
      res.render('home',{
          user : req.user
      });
  });
  app.post('/static/webrtc.js', function(req, res) {
    res.setHeader('Content-Type', 'application/javascript'); //Tell the client you are sending plain text
    console.log('tryyyy') 
    res.end(req.cookies); //Send the post data to the client and end the request
});

  app.get('/login',(req,res) => {
      res.render('login')
  });

  app.post('/login',passport.authenticate('local-login',{
          successRedirect : '/',
          failureRedirect : '/login',
          failureFlash: true
      }
  ));

  app.get('/signup',(req,res) => {
      res.render('signup');
  })

  app.post('/signup', passport.authenticate('local-signup', {
      successRedirect : '/', // redirect to the secure profile section
      failureRedirect : '/signup', // redirect back to the signup page if there is an error
      failureFlash : true // allow flash messages
  }));

  app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/login');
  });


      // route middleware to make sure a user is logged in
  function isLoggedIn(req, res, next) {

      // if user is authenticated in the session, carry on 
      if (req.isAuthenticated())
          return next();

      // if they aren't redirect them to the home page
      res.redirect('/login');
  }



  const httpsServer = https.createServer(serverConfig , app)
 httpsServer.listen(HTTPS_PORT, function(){
    console.log("app is listening on", HTTPS_PORT)
  })

//////// videoconference

  // Render the single client html file for any request the HTTP server receives
  // Create a server for the client html page
 
// Create a server for the client html page


// Create a server for handling websocket calls
// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({ server: httpsServer });
wss.getUniqueID = function () {
  function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
};

wss.on('connection', function (ws) {
  //ws.id = wss.getUniqueID();
  
  
  ws.on('message', function (message) {
    // Broadcast any received message to all clients
    console.log('received: %s', message);
    recv = JSON.parse(message)
    
    if(recv.state == "disconnected"){
     console.log("12345")
     if(count==0){
      count++
     wss.peerRefresh(message)
     
     }

    }else{

    if(CLIENTS1.length==0){
      CLIENTS1.push("first");
      ws.id = recv.uuid
      CLIENTS.push(ws.id)
      ws.len = CLIENTS.length-1
      wss.firstBroadcast(message)
    }
    else if(recv.dest == "all"){
      console.log("normal broadcast")
      ws.id = recv.uuid
      CLIENTS.push(ws.id)
      ws.len = CLIENTS.length-1
      wss.broadcast(message);
    }else{
      wss.reverseBroadcast(message)
    }
  }
    
    
  });

  ws.on('error', () => ws.terminate());
});

wss.peerRefresh = function(data){
  recv = JSON.parse(data)
  console.log(CLIENTS, recv.uuid);
  var i;
  for(i=0;i<CLIENTS.length;i++){
    console.log(recv.uuid, CLIENTS[i], "comap");
    if(String(recv.uuid) == String(CLIENTS[i])){
      flag=i;
      console.log(flag,"this is flag");
      delete CLIENTS[i];
      break
    }
  }
  this.clients.forEach(function (client){
    //console.log(flag, client.len)
    console.log(client.len,client.id,"this is client");
    if(client.len == flag-1){
      //console.log(CLIENTS);
      if (client.readyState === WebSocket.OPEN){
      client.send(JSON.stringify({'displayName': "abc" , 'uuid': CLIENTS[flag+1], 'dest': "all"}));
      console.log("data sent !!!")
    }}
  })
}

wss.firstBroadcast = function (data){
  recv = JSON.parse(data)
  console.log(recv.uuid, "its data")
  this.clients.forEach(function (client){
      if (client.readyState === WebSocket.OPEN) {  
        client.send(JSON.stringify({ 'displayName': recv.displayName, 'uuid': recv.uuid, 'dest': recv.dest, "first" : 0}));
        }
    });
}

wss.reverseBroadcast = function (data){
  console.log("reverse broadcast", recv.dest)
  this.clients.forEach(function (client){
    if(client.id == recv.dest){
      if (client.readyState === WebSocket.OPEN) {  
        client.send(data);
        }
    }
  });
}
wss.broadcast = function (data) {
  
  this.clients.forEach(function (client) {
    console.log(data , "sanya");
    if (CLIENTS.length==1){
      if (client.readyState === WebSocket.OPEN) {  
      client.send(data);
      }
    }
    else if(client.id==CLIENTS[CLIENTS.length-2]){
      console.log(client.id,"BBBBBBBB");
    
    if (client.readyState === WebSocket.OPEN) {
      
      client.send(data);
    }
    }
    
  });


};



console.log('Server running.');


// ----------------------------------------------------------------------------------------

// Separate server to redirect from http to https
http.createServer(function (req, res) {
    console.log(req.headers['host']+req.url);
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(HTTP_PORT);

// ----------------------------------------------------------------------------------------

  