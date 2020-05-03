const HTTPS_PORT = 8443; //default port for https is 443
const HTTP_PORT = 8001; //default port for http is 80
var CLIENTS = []
const fs = require('fs');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
// based on examples at https://www.npmjs.com/package/ws 
const WebSocketServer = WebSocket.Server;

// Yes, TLS is required
const serverConfig = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

// ----------------------------------------------------------------------------------------

// Create a server for the client html page
const handleRequest = function (request, response) {
  // Render the single client html file for any request the HTTP server receives
  console.log('request received: ' + request.url);

 if (request.url === '/webrtc.js') {
    response.writeHead(200, { 'Content-Type': 'application/javascript' });
    response.end(fs.readFileSync('client/webrtc.js'));
  } else if (request.url === '/style.css') {
    response.writeHead(200, { 'Content-Type': 'text/css' });
    response.end(fs.readFileSync('client/style.css'));
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(fs.readFileSync('client/index.html'));
  }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT);

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
    if(recv.dest == "all"){
      ws.id = recv.uuid
      CLIENTS.push(ws.id)
      ws.len = CLIENTS.length-1
      wss.broadcast(message);
    }else{
      wss.reverseBroadcast(message)
    }
    
    //console.log("kanha", ws.id, ws.clientCount)
  });

  ws.on('error', () => ws.terminate());
});
wss.reverseBroadcast = function (data){
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
    //console.log('Client.ID: ' + client.id)
    //console.log(data , "sanya");
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