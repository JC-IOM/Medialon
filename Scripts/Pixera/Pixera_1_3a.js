// Javascript for Medialon MXM Script
// Device: Pixera Media Server
// Created by Joe Callister
// Copyright (c) 2023 Joe Callister
// September 2023
// Version 1.0 - Initial version
// Version 1.1 - Working version! - Added new buffer handler function to deal with null bytes in reply string
// Version 1.2 - QMedialon TCP issues resolved
// Version 1.3 - TCP re-connection improvements

({
  //---------------------------------------------------------------------------
  // Information object for MXM Script
  // To define device commands and associated variables
  //---------------------------------------------------------------------------
  Info:{
    Title:"Pixera Media Server",
    Author:"Joe Callister",
    Version:"1.3a",
    Description:"Pixera media server network control",
    Brand:"AV Stumpfl",
    Model:"Pixera",
  
    //Define device setup
    Setup:{
      setupTopLabel:{ Widget:"Label" },
      setupIPAddress:{ MaxLength:15, Width:200, Name:"IP Address" },
      setupPort:{MaxLength:15, Width:200, Name:"Port" },
      setupDivider1:{Widget:"Divider"},
      setupTLName:{ MaxLength:30, Width:300, Name:"Timeline Name" }  
    },

    //Define device options
    Options:{
      RemoveDefaultCommandsAndVariables:true,
   },
  
    //Define device commands
    Commands:{

      timelineTransport:{
        Name:"Timeline Transport",
        GroupName: "Transport",
        GroupOrder: "0",
        GroupCmdOrder: "0",
        Params:{
          mode:{Name:"Mode", Type:"Enum", Items:[ "Play", "Pause", "Stop" ]}
        }
      },

      gotoCueIndex:{
        Name:"Goto Cue Index",
        GroupName: "Goto",
        GroupOrder: "1",
        GroupCmdOrder: "0",
        Params:{
          cue:{Name:"Cue Index", Type:"Integer"}
        }
      },

      gotoCueName:{
        Name:"Goto Cue Name",
        GroupName: "Goto",
        GroupOrder: "1",
        GroupCmdOrder: "1",
        Params:{
          cue:{Name:"Cue Name", Type:"String"}
        }
      },

      gotoTimecode:{
        Name:"Goto Timecode",
        GroupName: "Goto",
        GroupOrder: "1",
        GroupCmdOrder: "2",
        Params:{
          timecode:{Name:"Timecode", Type:"Time", TimeCodeType: 4}
        }
      },

      shutdown:{
        Name:"Shutdown",
        GroupName: "Utility",
        GroupOrder: "3",
        GroupCmdOrder: "0",
        Params:{
          mode:{Name:"Mode", Type:"Enum", Items:[ "Shutdown", "Shutdown Power Off", "Reboot" ]}
        }
      }

       
    },
  

    //Define types of public variables
    Variables:{
      ConnectionStatus:{Type:"Enum", Items:[ "Unconnected", "Connecting", "Ready", "Busy", "Error" ]},

      TransportMode:{Type:"Enum", Items:[ "Unknown", "Playing", "Paused", "Stopped" ]},
      Timecode:{Type:"Time", TimeCodeType: 4},
      FPS:{Type:"Integer"}

    },
  
  },
  
  //---------------------------------------------------------------------------
  // Device setup and device variables
  //---------------------------------------------------------------------------
  //Default device setup values
  Setup: {
    setupTopLabel: "PIXERA Setup",
    setupIPAddress: "10.0.0.1",
    setupPort: 1400,
    setupDivider1: 0,
    setupTLName: ""
  },
  
  //Device variables 
  Device: {
    ConnectionStatus: 0,
    TransportMode: 0,
    TransportModeString: "",
    Timecode: 0,
    FPS: 0
   // RX: "",
   // TX: ""
  },
  
  //---------------------------------------------------------------------------
  //  Local Variables
  //---------------------------------------------------------------------------
  tcpClient: null,
  tcpBuffer$: "",
  reconnectID: null,
  feedbackID: null,
  
  //---------------------------------------------------------------------------
  // Public Functions
  // Called by device commands
  //---------------------------------------------------------------------------

  timelineTransport:function(mode){
    method = "Pixera.Compound.setTransportModeOnTimeline";
    params = {timelineName: this.Setup.setupTLName, mode: parseInt(mode + 1)};
    this._sendJSON(22,method,params);
  },

  gotoCueIndex:function(cue){
    method = "Pixera.Compound.applyCueNumberOnTimeline";
    params = {timelineName: this.Setup.setupTLName, cueNumber: parseInt(cue)};
    this._sendJSON(34,method,params);
  },

  gotoCueName:function(cue){
    method = "Pixera.Compound.applyCueOnTimeline";
    params = {timelineName: this.Setup.setupTLName, cueName: cue};
    this._sendJSON(35,method,params);
  },

  gotoTimecode:function(timecode){
    method = "Pixera.Compound.setCurrentTimeOfTimeline";

    //Convert Medialon timecode from 100fps frame count
    hrsFrames = QMedialon.TimeStringToHours(timecode,4) * 360000;
    minsFrames = QMedialon.TimeStringToMinutes(timecode,4) * 6000;
    secsFrames = QMedialon.TimeStringToSeconds(timecode,4) * 100;
    frames = QMedialon.TimeStringToFrames(timecode,4);

    totalFrames = hrsFrames + minsFrames + secsFrames + frames;

    time = parseInt((totalFrames / 100) * this.Device.FPS); //Convert Medialon frames (100fps) to current timeline fps
    params = {timelineName: this.Setup.setupTLName, time: time};
    this._sendJSON(42,method,params);
  },

  shutdown:function(mode){
    method = "Pixera.Session.shutdownSystem";
    params = {mode: parseInt(mode + 1)};
    this._sendJSON(48,method,params);
  },


  
  
  //---------------------------------------------------------------------------
  // private functions
  //---------------------------------------------------------------------------
  
  //Start function - called when script is initalised
  _mStart: function() {
    
    this.tcpClient = QMedialon.CreateSocket();

    this.tcpClient.on('connect',this._OnSocketConnect );
    this.tcpClient.on('close',this._OnSocketDisconnect );
    this.tcpClient.on('error',this._OnSocketError );
    this.tcpClient.on('data',this._OnSocketData );


    //Connect to TCP server after start-up delay
    QMedialon.SetTimeout(this._socketConnect, 2000);
  },

  
  _socketConnect:function(){
    this.Device.ConnectionStatus= 1;
    this.Device.TransportModeString = "Unknown";
    this.tcpClient.connect(this.Setup.setupPort, this.Setup.setupIPAddress, this._OnSocketConnect);
    QMedialon.SetTimeout(this._socketConnectTimeout, 2000);
  },


  _socketConnectTimeout:function(){
    if(this.Device.ConnectionStatus != 2){
        this.Device.ConnectionStatus = 4;
        QMedialon.SetTimeout(this._socketConnect, 1000);
    }
  },
  

  //TCP socket callbacks
  _OnSocketConnect: function(){

    this.Device.ConnectionStatus= 2;
    QMedialon.SetTimeout(this._OnDeviceConnection, 1000);

    this.feedbackID = QMedialon.SetInterval(this._getFeedback, 500);
  },

  _OnSocketError : function(error){
    this.Device.ConnectionStatus = 4;
    QMedialon.ClearInterval(this.feedbackID);
    QMedialon.SetTimeout(this._autoreconnection, 2000);
  },

  _OnSocketDisconnect: function(){
    this.Device.ConnectionStatus= 0;
    QMedialon.ClearInterval(this.feedbackID);
    QMedialon.SetTimeout(this._autoreconnection, 2000);
  },

  _autoreconnection: function () {
    this._socketConnect();
  },
  

  _OnSocketData: function(data){ 

      this.Device.ConnectionStatus = 2; 

      header = 'pxr1';

      bufString = this._bufToString(data);

      //this.Device.RX = bufString;

      if (bufString.substring(0,4) == header) {

      var bufArray = bufString.split(header);

          for(i = 1; i < bufArray.length;i++){


              rcv_cmd = JSON.parse(bufArray[i].substr(1));

              switch (rcv_cmd["id"]) {
                  case 45:
                    result = rcv_cmd['result'];
                    this.Device.FPS = parseInt(result);
                    break;
                  case 46:
                    result = rcv_cmd['result'];
                    this.Device.Timecode = parseInt((parseInt(result) / this.Device.FPS) * 100); //Convert to Medialon 100fps
                    break;
                  case 23:
                    result = rcv_cmd['result'];
                    resultInt = parseInt(result);

                    if(resultInt == 1){
                      this.Device.TransportMode = 1;
                      this.Device.TransportModeString = "Playing";
                    } else if(resultInt == 11){
                      this.Device.TransportMode = 2;
                      this.Device.TransportModeString = "Paused";
                    } else if(resultInt == 21){
                      this.Device.TransportMode = 3;
                      this.Device.TransportModeString = "Stopped";
                    } else {
                      this.Device.TransportMode = 0;
                      this.Device.TransportModeString = "Unknown";
                    }
                    break;
                }

          }


      }

  },


  _bufToString:function(data){

      bufLength = data.length;
      outputString = "";


      for(i = 0; i < bufLength; i++){
        if(data[i] > 0){
          outputString = outputString + String.fromCharCode(data[i]);
        }  
      }

      return outputString

  },



  //Function runs after device initial connection
  _OnDeviceConnection:function(){
    
  },
  

  _sendJSON:function(id,method,params){
    body$ = JSON.stringify({jsonrpc: "2.0", id: id, method: method, params: params})
    bodyLength = body$.length;


    header$ = "pxr1" + String.fromCharCode(bodyLength) + "\0\0\0";

    packet$ = header$ + body$;

    this.tcpClient.write(packet$);

    //this.Device.TX = body$;

  },


  _getFeedback:function(){

    method = "Pixera.Compound.getFpsOfTimeline";
    params = {timelineName: this.Setup.setupTLName};
    this._sendJSON(45,method,params);

    method = "Pixera.Compound.getCurrentTimeOfTimeline";
    params = {timelineName: this.Setup.setupTLName};
    this._sendJSON(46,method,params);

    method = "Pixera.Compound.getTransportModeOnTimeline";
    params = {timelineName: this.Setup.setupTLName};
    this._sendJSON(23,method,params);

  }
  
})