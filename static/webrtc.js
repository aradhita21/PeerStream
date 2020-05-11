const WS_PORT = 8443; //make sure this matches the port for the webscokets server
var arr = [];
var localUuid; //unique id of the client
var localDisplayName; //displayName entered by the client 
var localStream; //local source of audio and video
var remoteStream;
var serverConnection; //to set up a webSocket
var peerConnections = {}; // an object used to store information about the connecting peers;key is uuid, values are peer connection object and user defined display name string
var first =0;
var flag;
var count=0;
var masterStream;
var peerStream;
var peerConnectionConfig = { 
  'iceServers': [          
    { 'urls': 'stun:stun.stunprotocol.org:3478' },
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
};


// specify no audio for user media
var constraints = {
    video: {
      width: {max: 320},
      height: {max: 240},
      frameRate: {max: 30},
    },
    audio: true,
  };

//generate a random identifier and capture a user-entered display name
function start() {         
  localUuid = createUUID();  //create a unique identification id for every new peer

  
  var urlParams = new URLSearchParams(window.location.search); // returns a URLSearchParams() object instance.
  localDisplayName =  urlParams.get('displayName') || prompt('Enter your name', ''); // check if "&displayName=xxx" is appended to URL, otherwise alert user to populate
  document.getElementById('localVideoContainer').appendChild(makeLabel(localDisplayName)); //append the displayName to the localVideoContainer 


  // set up local video stream
  if (navigator.mediaDevices.getUserMedia) { //to check that the browser supports getUserMedia API
    navigator.mediaDevices.getUserMedia(constraints) //prompts the user for permission to use up to one video input device and up to one audio input device 
      .then(stream => {
        localStream = stream;
        document.getElementById('localVideo').srcObject = stream; //the stream is assigned to localVideo
      }).catch(errorHandler) //function errorHandler called in case of any error

      // set up websocket and message all existing clients
      .then(() => {
        
        //serverConnection = new WebSocket('wss://' + window.location.hostname);
        serverConnection = new WebSocket('wss://' + "192.168.0.4:8443");
        serverConnection.onmessage = gotMessageFromServer; // on getting a message from the server call gotMessageFromServer
        serverConnection.onopen = event => { //when the connection is open send localDisplayName and localUuid to all peers
          serverConnection.send(JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': 'all' }));
        }
      }).catch(errorHandler);

  } else { //if the browser does not support getUserMedia API issue an alert
    alert('Your browser does not support getUserMedia API');
  }
}
// create a function to classify and respond to messages received from the server
function gotMessageFromServer(message) {
  var signal = JSON.parse(message.data); //convert the JSON string into an object.
  console.log(signal)
  var peerUuid = signal.uuid; //assign the signal id as the peer id
  if(signal.first!=undefined){
  flag = signal.first
  }
  if (signal.first == 0){
    masterStream=localStream
    setUpPeer(peerUuid, signal.displayName, false, flag)
    return
    
  }

  if (peerUuid == localUuid || (signal.dest != localUuid)&&(signal.dest!= "all" )) return;

  if (signal.displayName && signal.dest=="all") {
    // set up peer connection object for a newcomer peer
    setUpPeer(peerUuid, signal.displayName);
    serverConnection.send(JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': peerUuid }));

  } else if (signal.displayName && signal.dest == localUuid) {
    // initiate call if we are the newcomer peer
    setUpPeer(peerUuid, signal.displayName, true);

  } else if (signal.sdp) {
    peerConnections[peerUuid].pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
      // Only create answers in response to offers
      if (signal.sdp.type == 'offer') {
        peerConnections[peerUuid].pc.createAnswer().then(description => createdDescription(description, peerUuid)).catch(errorHandler);
      }
    }).catch(errorHandler);

  } else if (signal.ice) { //create a new ice candidate and add to the specific peerUuid
    peerConnections[peerUuid].pc.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    
  }
}
//if we have a new peer, we can add them to the peerConnections object, with the UUID as a key
function setUpPeer(peerUuid, displayName, initCall = false, f=1) {

  console.log(flag)
  if(flag == 0){
    console.log("if")
    peerConnections[peerUuid] = { 'displayName': displayName, 'pc': new RTCPeerConnection(peerConnectionConfig) };
    peerConnections[peerUuid].pc.onicecandidate = event => gotIceCandidate(event, peerUuid);
    //peerConnections[peerUuid].pc.ontrack = event => gotRemoteStream(event, peerUuid);
    peerConnections[peerUuid].pc.oniceconnectionstatechange = event => checkPeerDisconnect(event, peerUuid);
    if(masterStream != undefined){peerConnections[peerUuid].pc.addStream(masterStream);}
    
  }
  else{
    peerConnections[peerUuid] = { 'displayName': displayName, 'pc': new RTCPeerConnection(peerConnectionConfig) };
    peerConnections[peerUuid].pc.onicecandidate = event => gotIceCandidate(event, peerUuid);
    peerConnections[peerUuid].pc.ontrack = event => gotRemoteStream(event, peerUuid,vidContainer);
    peerConnections[peerUuid].pc.oniceconnectionstatechange = event => checkPeerDisconnect(event, peerUuid);
    
    if(localStream != undefined && remoteStream==undefined){peerConnections[peerUuid].pc.addStream(localStream);}
    if(remoteStream!=undefined){peerConnections[peerUuid].pc.addStream(remoteStream);}
    
    setTimeout(function (){if((remoteStream != undefined)&&(first==1)){
      peerConnections[peerUuid].pc.removeStream(localStream)
      peerConnections[peerUuid].pc.addStream(remoteStream)
      first++;
      
    }}, 3000);
     
  console.log("else")}
  
  
  
  if (initCall) { //if the message is for initiating the connection
    peerConnections[peerUuid].pc.createOffer().then(description => createdDescription(description, peerUuid)).catch(errorHandler);//create offer and call function to create sdp
    
  }

}
//  accepts as input an RTCPeerConnectionIceEvent object representing the icecandidate event
// delivers the ICE candidate to the remote peer through the signaling server. 
function gotIceCandidate(event, peerUuid) {
  
  if (event.candidate != null) {
    serverConnection.send(JSON.stringify({ 'ice': event.candidate, 'uuid': localUuid, 'dest': peerUuid }));
    if (event && event.target && event.target.iceGatheringState === 'complete') {
      console.log('done gathering candidates - got iceGatheringState complete');
      peerConnections[peerUuid].pc.removeStream(localStream)
  } else if (event && event.candidate == null) {
      console.log('done gathering candidates - got null candidate');
      
  } else {
        console.log(event.target.iceGatheringState, event);   
  }
    
  }
}
//function to exchange sdp
function createdDescription(description, peerUuid) {
  console.log(`got description, peer ${peerUuid}`);
  peerConnections[peerUuid].pc.setLocalDescription(description).then(function () {
    serverConnection.send(JSON.stringify({ 'sdp': peerConnections[peerUuid].pc.localDescription, 'uuid': localUuid, 'dest': peerUuid }));//send sdp to the peer 
  }).catch(errorHandler);
}
var vidContainer = document.createElement('div');
//function to create video element and set its attributes once got the remote stream from peer
function gotRemoteStream(event, peerUuid, vidContainer) {

  console.log(`got remote stream, peer ${peerUuid}`);
  //assign stream to new HTML video element
  var vidElement = document.createElement('video'); //create a video element
  vidElement.setAttribute('autoplay', ''); //enable autoplay
   //sets vidElement as event stream
  if(first==0){
  vidElement.srcObject = event.streams[0];
  remoteStream = event.streams[0];
  first++;
  }
  
  //var vidContainer = document.createElement('div'); //create a HTMLDivElement
  vidContainer.setAttribute('id', 'remoteVideo_' + peerUuid); //add comment
  
  arr.push('remoteVideo_' + peerUuid) // add comment 
  if(count==1){
    var peerStream;
    peerStream = event.streams[0];
    vidContainer.setAttribute('id', 'remoteVideo_' + peerUuid);
    var vidElement1 = document.createElement('video');
    var vidElement2 = document.createElement('video');
    vidElement1.setAttribute('autoplay', '');
    vidElement2.setAttribute('autoplay', '');
    
    //peerConnections[peerUuid].pc.addStream(peerStream);
    //peerConnections[peerUuid].pc.addStream(peerStream);
    setTimeout(function (){
      vidElement1.srcObject = peerStream;
      vidElement2.srcObject = remoteStream;
    vidContainer.appendChild(vidElement1); //append the video element to the vidContainer
    vidContainer.appendChild(vidElement2);
    vidContainer.appendChild(makeLabel(peerConnections[peerUuid].displayName));//append the label containing display name of the peer to vidContainer
    }, 2000);
    
    count=0;

  document.getElementById('videos').appendChild(vidContainer);
  
  updateLayout();
  }
  if(arr[0] != arr[1]){  
   // if(vidContainer.childNodes.length == 0) //adds a new peer only if the peer is not already present in the meeting
  vidContainer.setAttribute('class', 'videoContainer');
  //if(vidContainer.childNodes.length === 0)
 //{
  vidContainer.appendChild(vidElement); //append the video element to the vidContainer
  vidContainer.appendChild(makeLabel(peerConnections[peerUuid].displayName));//append the label containing display name of the peer to vidContainer

  document.getElementById('videos').appendChild(vidContainer);
  
  updateLayout();
//} 
}else if(arr[0] == arr[1]){
  arr=[]
}
}
// function to check if peer disconnected on iceconnectionstatechange event
function checkPeerDisconnect(event, peerUuid) {
  
  var state = peerConnections[peerUuid].pc.iceConnectionState; //assign state the iceConnectionState of the specific peerUuid
  console.log(`connection with peer ${peerUuid} ${state}`);
  if (state === "failed" || state === "closed" || state === "disconnected") { //check if the connection is failed, closed or disconnected
    serverConnection.send(JSON.stringify({ uuid: peerUuid , 'state': "disconnected" }));
    count=1;
    delete peerConnections[peerUuid]; //delete the peer details from the object peerConnections
    document.getElementById('videos').removeChild(document.getElementById('remoteVideo_' + peerUuid)); //remove the peer 
    updateLayout(); //update the layout on deletion
  }
}
 //function to update CSS grid based on number of diplayed videos
function updateLayout() {
 
  var rowHeight = '98vh';
  var colWidth = '98vw';

  var numVideos = Object.keys(peerConnections).length + 1 ; // add one to include local video

  if (numVideos > 1 && numVideos <= 4) { // 2x2 grid
    rowHeight = '48vh';
    colWidth = '48vw';
  } else if (numVideos > 4) { // 3x3 grid
    rowHeight = '32vh';
    colWidth = '32vw';
  }

  document.documentElement.style.setProperty(`--rowHeight`, rowHeight);
  document.documentElement.style.setProperty(`--colWidth`, colWidth);
}
//function to create the video label
function makeLabel(label) {
  var vidLabel = document.createElement('div');
  vidLabel.appendChild(document.createTextNode(label));
  vidLabel.setAttribute('class', 'videoLabel');
  return vidLabel;
}
// function to notify error
function errorHandler(error) {
  console.log(error);
}


// function to create unique id for a new peer
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}