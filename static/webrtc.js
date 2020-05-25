const WS_PORT = 8443; //make sure this matches the port for the webscokets server
var localUuid; //unique id of the client
var localDisplayName; //displayName entered by the client 
var localStream; //local source of audio and video
var remoteStream; //video stream received from previous client
var serverConnection; //to set up a webSocket
var vidElement;
var peerConnections = {}; // an object used to store information about the connecting peers;key is uuid, values are peer connection object and user defined display name string
//defining variables to be used later in the code
var count=0;
var first =0;
var flag;
var arr = [];
//configuration details of the RTCPeerConnection
var peerConnectionConfig = { // STUN server used for NAT traversal
  'iceServers': [         //ice servers defined 
    { 'urls': 'stun:stun.stunprotocol.org:3478' },
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
};

// specify audio and video constraints for user media
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
  //create a unique identification id for every new peer
  localUuid = createUUID();  

  var urlParams = new URLSearchParams(window.location.search); 
  // returns a URLSearchParams() object instance.
 localDisplayName =  urlParams.get('displayName') || prompt('Enter your name', ''); 
   // check if "&displayName=xxx" is appended to URL, otherwise alert user to populate
  document.getElementById('localVideoContainer').appendChild(makeLabel(localDisplayName)); 
  //append the displayName to the localVideoContainer 


  // set up local video stream
  //to check that the browser supports getUserMedia API
  if (navigator.mediaDevices.getUserMedia) { 

    //prompts the user for permission to use up to one video input device and up to one audio input device 
    navigator.mediaDevices.getUserMedia(constraints) 
      .then(stream => {
        localStream = stream;
        document.getElementById('localVideo').srcObject = stream; 
        //the stream is assigned to localVideo
      }).catch(errorHandler) 

      // set up websocket and message all existing clients
      .then(() => {
      
        serverConnection = new WebSocket('wss://' + window.location.hostname + ":8443");
        serverConnection.onmessage = gotMessageFromServer; 
        // on getting a message from the server call gotMessageFromServer
        serverConnection.onopen = event => { 
        //when the connection is open send localDisplayName and localUuid to all peers
          serverConnection.send(JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': 'all' }));
        }
      }).catch(errorHandler);

  } else { 
    //if the browser does not support getUserMedia API issue an alert
    alert('Your browser does not support getUserMedia API');
  }
}
// create a function to classify and respond to messages received from the server
function gotMessageFromServer(message) {
  //convert the JSON string into an object.
  var signal = JSON.parse(message.data); 
  var peerUuid = signal.uuid; 
  if(signal.first!=undefined){ 
  flag = signal.first  
  }
  //if a peer disconnects
  if(signal.value=="refreshing"){
    alert("reload the page if required");
    window.location.assign("/?&displayName=xxx");
    
    
  }
  //if peer is the first client
  if (signal.first == 0){ 
    
    // set up peer connection object for the master
    setUpPeer(peerUuid, signal.displayName, false, flag)
    return
    
  }
  // ignore messages that are not for us or from ourselves 
  if (peerUuid == localUuid || (signal.dest != localUuid)&&(signal.dest!= "all" )) return;

  
  if (signal.displayName && signal.dest=="all") {
    // set up peer connection object for a newcomer peer
    setUpPeer(peerUuid, signal.displayName); 
    //send localDisplayName and localUuid to peerUuid
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

  } else if (signal.ice) { 
    //create a new ice candidate and add to the specific peerUuid
    peerConnections[peerUuid].pc.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    
  }
}
//if we have a new peer, we can add them to the peerConnections object, with the UUID as a key
function setUpPeer(peerUuid, displayName, initCall = false, f=1) {
  peerConnections[peerUuid] = { 'displayName': displayName, 'pc': new RTCPeerConnection(peerConnectionConfig) };

  //function called on event iceconnectionstatechange 
  peerConnections[peerUuid].pc.oniceconnectionstatechange = event => checkPeerDisconnect(event, peerUuid);

  //if first client
  if(flag == 0){ 
    //function called when an ice candidate is received
    peerConnections[peerUuid].pc.onicecandidate = event => gotIceCandidate(event, peerUuid);
    //adds a media stream as a local source of audio or video  
    if(localStream != undefined){peerConnections[peerUuid].pc.addStream(localStream);} 
    
  }
  //for other clients
  else{ 
    //function called when an ice candidate is received
    peerConnections[peerUuid].pc.onicecandidate = event => gotIceCandidate(event, peerUuid); 
    //function to be called if event track takes place
    peerConnections[peerUuid].pc.ontrack = event => gotRemoteStream(event, peerUuid,vidContainer); 
  
    //add a media stream as a local source of audio or video if remoteStream is undefined
    if(localStream != undefined && remoteStream==undefined){peerConnections[peerUuid].pc.addStream(localStream);}
    //add a media stream as the remoteStream if it is defined
    if(remoteStream!=undefined){peerConnections[peerUuid].pc.addStream(remoteStream);}
    
    //wait until remoteStream gets defined
    setTimeout(function (){if((remoteStream != undefined)&&(first==1)){ 
      peerConnections[peerUuid].pc.removeStream(localStream)
      peerConnections[peerUuid].pc.addStream(remoteStream)
      first++;
      
    }}, 3000);
     
  }

  //check if the message is for initiating the connection
  if (initCall) { 
    //create offer and call function to create sdp
    peerConnections[peerUuid].pc.createOffer().then(description => createdDescription(description, peerUuid)).catch(errorHandler);
    
  }
}

//  accepts as input an RTCPeerConnectionIceEvent object representing the icecandidate event
// delivers the ICE candidate to the remote peer through the signaling server. 
function gotIceCandidate(event, peerUuid) {
  
  if (event.candidate != null) {
    serverConnection.send(JSON.stringify({ 'ice': event.candidate, 'uuid': localUuid, 'dest': peerUuid }));
    //remove stream of client to save bandwidth
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
var vidContainer = document.createElement('div'); //create a HTMLDivElement

//function to create video element and set its attributes once got the remote stream from peer
function gotRemoteStream(event, peerUuid,vidContainer) {
  console.log(`got remote stream, peer ${peerUuid}`);
  //create a video element
  vidElement = document.createElement('video'); 
  //enable autoplay
  vidElement.setAttribute('autoplay', '');
  //for peer conecting after reload
  if(count==1){
    var vidElement1 = document.createElement('video');
    vidElement1.setAttribute('autoplay', '');
    vidElement1.srcObject = event.streams[0]; //sets vidElement as event stream

    var vidElement2 = document.createElement('video');
    vidElement2.setAttribute('autoplay', '');
    vidElement2.srcObject = remoteStream //sets vidElement as remote stream
    
    //append the video elements to the vidContainer
    vidContainer.appendChild(vidElement1);
    vidContainer.appendChild(vidElement2);
    
    //append the label containing display name of the peer to vidContainer
    vidContainer.appendChild(makeLabel(peerConnections[peerUuid].displayName));

    document.getElementById('videos').appendChild(vidContainer);

    updateLayout();
  }
//for first client
  if(first==0){ 
  vidElement.srcObject = event.streams[0]; //sets vidElement as event stream
  remoteStream = event.streams[0]; //sets remoteStream as event stream
  first++;
  } 
  //a new attribute is added with the specified name and value
  vidContainer.setAttribute('id', 'remoteVideo_' + peerUuid); 
  // append the two concurrent streams onto the empty array
  arr.push('remoteVideo_' + peerUuid) 
  if(arr[0] != arr[1]){   //adds a new peer only if the peer is not already present in the meeting
  vidContainer.setAttribute('class', 'videoContainer');

  //to ensure that one client gets only one feed
  if(vidContainer.childNodes.length === 0) 
  {
    //append the video element to the vidContainer
    vidContainer.appendChild(vidElement); 
    //append the label containing display name of the peer to vidContainer
  vidContainer.appendChild(makeLabel(peerConnections[peerUuid].displayName));
  document.getElementById('videos').appendChild(vidContainer);
  
  updateLayout();
} 
  }
  else if(arr[0] == arr[1]){
  arr=[]
}
}

// function to check if peer disconnected on iceconnectionstatechange event
function checkPeerDisconnect(event, peerUuid) {
  //assign state the iceConnectionState of the specific peerUuid
  var state = peerConnections[peerUuid].pc.iceConnectionState; 
  console.log(`connection with peer ${peerUuid} ${state}`);

  //check if the connection is failed, closed or disconnected
  if (state === "failed" || state === "closed" || state === "disconnected") { 
    serverConnection.send(JSON.stringify({ uuid: peerUuid , 'state': "disconnected" }));
    //delete the peer details from the object peerConnections
    count=1; //incremented everytime a peer joins
    delete peerConnections[peerUuid]; 
    //remove the peer 
    document.getElementById('videos').removeChild(document.getElementById('remoteVideo_' + peerUuid)); 
    //update the layout on deletion
    updateLayout(); 
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
