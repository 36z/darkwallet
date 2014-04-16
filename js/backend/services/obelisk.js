define(['backend/port', 'darkwallet_gateway'],
function(Port) {
  'use strict';
  function ObeliskService(core) {
      var self = this;
      this.client = null;
      this.connected = false;
      this.connecting = false;
    
      // Port for communication with the frontend
      Port.listen('obelisk', function() {
        }, function(port) {
            // Connected
            console.log('[bus] obelisk client connected');
            var client = self.client;
            if (client && client.connected) {
                port.postMessage({'type': 'connected'});
            } else if (client && client.connecting) {
                port.postMessage({'type': 'connecting'});
            }
      }, function() {
          console.log('[bus] obelisk client disconnected');
      });
  }

  ObeliskService.prototype.connect = function(connectUri, handleConnect) {
      if (this.connected || this.connecting) {
          // wait for connection
      } else {
          console.log("[obelisk] Connecting");
          Port.post('obelisk', {'type': 'connecting'});
          this.connectClient(connectUri, function(err) {
              if (!err) {
                  console.log("[obelisk] Connected");
              }
              handleConnect ? handleConnect(err) : null;
              if (err) {
                  console.log("[obelisk] Error connecting");
                  Port.post('obelisk', {'type': 'connectionError', 'error': 'Error connecting'});
              } else {
                  Port.post('obelisk', {'type': 'connected'});
              }
          });
      }
  }

  ObeliskService.prototype.connectClient = function(connectUri, handleConnect) {
      var self = this;
      this.connecting = true;
      this.client = new GatewayClient(connectUri, function(err) {
          if (!err) {
              self.client.connected = true;
              self.connected = true;
          }
          self.connecting = false;
          handleConnect ? handleConnect(err) : null;
      });
  }

  ObeliskService.prototype.getClient = function() {
    return this.client;
  }

  return ObeliskService;

});
