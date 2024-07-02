// Javascript for Medialon MXM Script
// Device: Medialon Script TCP socket example
// Created by Joe Callister
// November 2023
//
// Copyright (c) 2023 Joe Callister
// Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php

// Version 1.0 - Initial version


({
  //---------------------------------------------------------------------------
  // Information object for MXM Script
  // To define device commands and associated variables
  //---------------------------------------------------------------------------
  Info:{
    Title:"TCP Socket Example",
    Author:"Joe Callister",
    Version:"1.0",
    Description:"Medialon Script TCP socket example",
    Brand:"Medialon",
    Model:"Script",
  
    //Define device setup
    Setup:{
      IPAddress:{ MaxLength:15, Width:200, Name:"IP Address" },
      IPPort:{ Widget:"SpinBox", MinValue:1024, MaxValue:60000, Name:"TCP/IP Port" },
      SocketTimeout:{ Widget:"SpinBox", MinValue:0, MaxValue:60000, Name:"Socket Timeout" },

    },

    //Define device options
    Options:{
      RemoveDefaultCommandsAndVariables:true,
   },
  
    //Define device commands
    Commands:{
    
      
      
    },
  
    //Define types of public variables
    Variables:{
      ConnectionStatus:{Type:"Enum", Items:[ "Unconnected", "Connecting", "Ready", "Busy", "Error" ]},

    },
  
  },
  
  //---------------------------------------------------------------------------
  // Device setup and device variables
  //---------------------------------------------------------------------------
  //Default device setup values
  Setup: {
    IPAddress: "10.0.0.1",
    IPPort: 4321,
    SocketTimeout: 30000,

  },
  
  //Device variables 
  Device: {
    ConnectionStatus: 0,


  },
  
  //---------------------------------------------------------------------------
  //  Local Variables
  //---------------------------------------------------------------------------
  tcpClient: null,
  timeoutID: null,

  
  //---------------------------------------------------------------------------
  // Public Functions
  // Called by device commands
  //---------------------------------------------------------------------------


  
  
  //---------------------------------------------------------------------------
  // private functions
  //---------------------------------------------------------------------------
  
  //Start function - called when script is initalised
  _mStart:function(){

    this.Device.ConnectionStatus= 0;


    //TCP socket
    this.tcpClient = QMedialon.CreateSocket();
    this.tcpClient.on('connect',this._onSocketConnect );
    this.tcpClient.on('close',this._onSocketDisconnect );
    this.tcpClient.on('error',this._onSocketError );
    this.tcpClient.on('data',this._onSocketData );

    //Connect to TCP server after start-up delay
    QMedialon.SetTimeout(this._socketConnect, 2000);
  },

  _mStop:function(){
    //Kill TCP socket instance
    this.tcpClient.end();
  },


  //TCP socket connection
  _socketConnect:function(){
      this.Device.ConnectionStatus = 1;
      this.Device.Device_Status = 0;
      this.tcpClient.connect(this.Setup.IPPort, this.Setup.IPAddress);

      //Connection timeout, should the socket connection attempt not throw an error
      QMedialon.SetTimeout(this._connectTimeout, 10000);
  },


  _connectTimeout:function(){
      if(this.Device.ConnectionStatus != 2){
          this.Device.ConnectionStatus = 0;
          this._socketConnect();
      }
  },
  
  //TCP socket callbacks
  _onSocketConnect:function(){
    this.Device.ConnectionStatus = 2;
    QMedialon.ClearInterval(this.connectionID);
    QMedialon.SetTimeout(this._onDeviceConnection, 1000);
  },

  _onSocketError:function(error){
    this.Device.ConnectionStatus = 4;
    QMedialon.SetTimeout(this._socketConnect, 5000);
  },

  _onSocketDisconnect:function(){
    this.Device.ConnectionStatus = 0;
    QMedialon.SetTimeout(this._socketConnect, 5000);
  },


  _onSocketData:function(data){  
    this.Device.ConnectionStatus = 2; 
    
    //Socket timeout
    if (this.Setup.SocketTimeout > 0){
      QMedialon.ClearTimeout(this.timeoutID);
      this.timeoutID = QMedialon.SetTimeout(this._socketConnect, this.Setup.SocketTimeout);
    }

    this._parseTCP(data.toString());
  },

  _sendTCP:function(frame){
    //frame = frame + '\n';
    //frame = frame + '\r';
    this.tcpClient.write(frame);
  },


  //Function runs after device initial connection
  _onDeviceConnection:function(){

  },


  //Process incoming TCP message from server
  _parseTCP:function(msg$){

  }
 

  
})





