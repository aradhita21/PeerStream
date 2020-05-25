//app secret : 5d65535f4ecb09f523398aef9f8137c0
//App ID: 2284950575134905
const express = require('express'); //to create express app
const exphbs = require('express-handlebars'); //to use handlebars with express
const mongoose = require('mongoose');//mongoDB object
const app = express();//creates a new express application as app
const passport = require('passport'); //for authentication
const flash = require('connect-flash');//provide flash middleware
const morgan = require('morgan'); //morgan logger middleware
const cookieParser = require('cookie-parser');// enabling cookieParser middleware for flash messages
const bodyParser = require('body-parser');//parse the request body for authentication
const session = require('express-session');// enabling session middleware for flash messages
//var config = require('./config/oauth.js');
//var FacebookStrategy = require('passport-facebook').Strategy;

const HTTPS_PORT = 8443; //default port for http is 80
var CLIENTS = [];
var CLIENTS1 = [];
const fs = require('fs');//file system to sync files
const http = require('http'); //for http request
const https = require('https');//for https request
const WebSocket = require('ws'); // for websocket

const WebSocketServer = WebSocket.Server; // handle Web Socket events and actions
// Yes, TLS is required
//dotenv package and injects it into our project configuration
require('dotenv').config(); //require and configure dotenv
app.engine('handlebars',exphbs({defaultLayout : 'main'}));//express engine, layout=main.handlebars
app.set('view engine','handlebars');//engine is viewed as handlebars

app.use(flash());//for requesting flash error
app.use(morgan('dev')); //using logger
app.use(cookieParser()); //use cookies
app.use(bodyParser.urlencoded({ extended: true })); //parse url request
app.use(bodyParser.json())//parse json requests
//app.use(express.static('static'))

//process.env now has the keys and values you defined in your .env file.
const MONGODB_URI = process.env.MONGODB_URL; //to access our database
mongoose.connect(MONGODB_URI,{ useNewUrlParser : true });//connect mongoose with database
var db = mongoose.connection;//db = database connection
db.on('error', console.error.bind(console, 'connection error:')); //error if not connected
db.once('open', function() { // if MongoDB open
    console.log('connected'); //display connected
});

app.use(session({secret : 'ilearnnodejs'}));//initialise session  for cookie handling
app.use(passport.initialize());//initiaalise passport authentication for our app
app.use(passport.session());//initialise passport session for app
app.use(flash()); //for using flash messages


app.use("/static", express.static('./static/'));//used to access webrtc.js file in static folder
require('./config/passport')(passport);//used to access passport.js file in cnfig
require('./routes/index')(app,passport);//used to access index.js in routes //no need, all elements are included here

const serverConfig = {  //defining server configuration
  key: fs.readFileSync('key.pem'), //reading file key.pem
  cert: fs.readFileSync('cert.pem'),//reading file cert.pem
// key: fs.readFileSync('myKey.pem'), //reading file key.pem
  //cert: fs.readFileSync('cert.crt'),//reading file cert.pem
 // csr : fs.readFileSync('csr.pem'),
};

const httpsServer = https.createServer(serverConfig , app) // create server with cert, key, and app
 httpsServer.listen(HTTPS_PORT, function(){ //listen at 8443 port
    console.log("app is listening on", HTTPS_PORT)
  })

const wss = new WebSocketServer({ server: httpsServer });
wss.getUniqueID = function () {
  function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
};
//when a connection is established
wss.on('connection', function (ws) {

  ws.on('message', function (message) {
    console.log('received: %s', message);

    //converting a JSON object into a normal object
    recv = JSON.parse(message) 
    
    //if a peer disconnects
    if(recv.state == "disconnected"){
      //call function to handle change in connection state
      wss.peerRefresh(message)
  
    }
    else{
      //for first client
    if(CLIENTS1.length==0){
      CLIENTS1.push("first");
      //push in CLIENTS the uuid of first peer
      ws.id = recv.uuid
      CLIENTS.push(ws.id)
      ws.len = CLIENTS.length-1
      wss.firstBroadcast(message)
    }
    //for any new peer connecting
    else if(recv.dest == "all"){
      console.log("normal broadcast")
      ws.id = recv.uuid
      //push in CLIENTS the uuid of new peer
      CLIENTS.push(ws.id)
      ws.len = CLIENTS.length-1
      wss.broadcast(message);
    }
    //to send a reply to the new peer
    else{
      wss.reverseBroadcast(message)
    }
  }
    
  });
  //terminate the socket on error
  ws.on('error', () => ws.terminate());
});

//broadcast message to all clients along with parameter first to identify the master
wss.firstBroadcast = function (data){

  //converting a JSON object into a normal object
  recv = JSON.parse(data) 
  //a loop for each client
  this.clients.forEach(function (client){
      if (client.readyState === WebSocket.OPEN) {  
        //sends a JSON string to all clients
        client.send(JSON.stringify({ 'displayName': recv.displayName, 'uuid': recv.uuid, 'dest': recv.dest, "first" : 0}));
        }
    });
}
//to handle disconnect requests
wss.peerRefresh = function(data){
  recv = JSON.parse(data)
  var i;
  for(i=0;i<CLIENTS.length;i++){
    console.log(recv.uuid, CLIENTS[i], "comap");
    //to find the position of disconnected peer in array
    if(String(recv.uuid) == String(CLIENTS[i])){
      flag=i;
      //delete CLIENTS[i] using splice(start number,delete count);
      CLIENTS.splice(i, 1);
      this.clients.forEach(function (client){
        //send a message to refresh the window for all clients following the disconnected client
        if(client.len>flag){
          if (client.readyState === WebSocket.OPEN){
            
            client.send(JSON.stringify({'value':'refreshing'}));
            CLIENTS.splice(flag,1); //delete all the clients that are connected after flag
          }
        }
          
      });
      break
      }
  }
          
  
}
//to send response to a peer
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
//broadcast function to send data selectively
wss.broadcast = function (data) {
  
  this.clients.forEach(function (client) {
    //if there is only one client
    if (CLIENTS.length==1){
      if (client.readyState === WebSocket.OPEN) {  
      client.send(data);
      }
    }
    //every new connecting peer connects to only its predecessor
    else if(client.id==CLIENTS[CLIENTS.length-2]){
     
    if (client.readyState === WebSocket.OPEN) {
      
      client.send(data);
    }
    }
    
  });


};



console.log('Server running.');


// ----------------------------------------------------------------------------------------
const HTTP_PORT = 8001;
// Separate server to redirect from http to https
http.createServer(function (req, res) {
    console.log(req.headers['host']+req.url);
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(HTTP_PORT);