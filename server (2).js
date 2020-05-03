const HTTPS_PORT = 8443; //default port for https is 443
const HTTP_PORT = 8001; //default port for http is 80

const fs = require('fs'); //To include the File System module
const http = require('http');// To include the HTTP module
const https = require('https');// To include the HTTPS module
const WebSocket = require('ws'); //To include the WebSocket module

const WebSocketServer = WebSocket.Server;//responds to events and performs actions when necessary

// Yes, TLS is required
const serverConfig = {  //defining server configuration
  key: fs.readFileSync('key.pem'), //reading file key.pem
  cert: fs.readFileSync('cert.pem'),//reading file cert.pem
};

// ----------------------------------------------------------------------------------------

// Create a server for the client html page
const handleRequest = function (request, response) {
  // Render the single client html file for any request the HTTP server receives
  console.log('request received: ' + request.url);

 if (request.url === '/webrtc.js') {
    response.writeHead(200, { 'Content-Type': 'application/javascript' });
    response.end(fs.readFileSync('client/webrtc.js'));//respond by reading js file
  } else if (request.url === '/style.css') {
    response.writeHead(200, { 'Content-Type': 'text/css' });
    response.end(fs.readFileSync('client/style.css'));//respond by reading css file
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(fs.readFileSync('client/index.html'));//respond by reading html file
  }
};
//Create a https server that listens on HTTPS_PORT = 8443 and handle websocket connections
const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT); //listening at port 8443

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({ server: httpsServer });// new websocket.server defined above
//websocket server listens to HTTPS_PORT 

wss.on('connection', function (ws) { // client connected
  ws.on('message', function (message) {//incoming message to server
    console.log('received: %s', message); // verifies that message is received
    wss.broadcast(message); // broadcast the received message to all clients
  });

  ws.on('error', () => ws.terminate()); //terminate websocket connection
});

//send broadcast to all connected client which open socket and wait for incoming data
wss.broadcast = function (data) {
  this.clients.forEach(function (client) { //check for every client
    //A client WebSocket broadcasting to every other connected WebSocket clients, excluding itself.
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

console.log('Server running.'
);

// ----------------------------------------------------------------------------------------

// Separate server to redirect from http to https
http.createServer(function (req, res) {
    console.log(req.headers['host']+req.url);
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(HTTP_PORT);