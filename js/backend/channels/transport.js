'use strict';

define(['bitcoinjs-lib', 'backend/channels/peer'],
function (Bitcoin, Peer) {


  /************************************
   * Transport
   */
  function Transport(identity, obeliskService) {
    this.obelisk = obeliskService;
    this.channels = {};
    this.sessionKey = {};

    this.peers = [];
    this.peerIds = [];
    this.subscribed = false;

    this.newSession();

    // Identity (communications) key
    var selfKey;
    if (identity.store.get('commsKey')) {
        selfKey = new Bitcoin.ECKey(identity.store.get('commsKey'));
    }
    else {
        selfKey = new Bitcoin.ECKey();
        selfKey.compressed = true;
        identity.store.set('commsKey', selfKey.toBytes());
        identity.store.save();
    }
    this.getSelfKey = function() { return selfKey; };
    this.getSessionKey = function() { return this.sessionKey; };

    // Initialize some own data
    this.comms = new Peer(this.sessionKey.getPub().toBytes(true));
    this.myself = new Peer(selfKey.getPub().toBytes(true));
  }

  /**
   * Initialize a new discardable session key
   */
  Transport.prototype.newSession = function() {
    var self = this;
    this.sessionKey = new Bitcoin.ECKey();
    this.sessionKey.compressed = true;


    Object.keys(this.channels).forEach(function(name) {
        self.channels[name].prepareSession();
    });
  };

  /**
   * Initialize a new discardable session key
   */
  Transport.prototype.getClient = function() {
    return this.obelisk.getClient();
  };

  /**
   * Initialize and add peer, or just return it if it just exists
   */
  Transport.prototype.addPeer = function(pubKey, fingerprint) {
      var peer;
      var index = this.peerIds.indexOf(fingerprint);
      if (index == -1) {
          peer = new Peer(pubKey, fingerprint);
          this.peerIds.push(fingerprint);
          this.peers.push(peer);
      } else if (pubKey) {
          peer = this.peers[index];
          peer.updateKey(pubKey);
      }
      return peer;
  };

  /**
   * Initialize a channel or get an existing channel if the name is registered
   */
  Transport.prototype.initChannel = function(name, chanClass) {
      var channel;
      console.log("[transport] init channel", name);
      if (this.channels.hasOwnProperty(name)) {
          channel = this.channels[name];
      } else {
          console.log("[transport] create channel", name);
          channel = new chanClass(this, name);
          this.channels[name] = channel;
      }
      channel.sendOpening();
      return channel;
  };

  /**
   * Close a channel by name
   */
  Transport.prototype.closeChannel = function(name) {
      if (!this.channels.hasOwnProperty(name)) {
          throw Error("Channel does not exist");
      }
      console.log("[transport] close channel", name);
      this.channels[name].disconnect();
      delete this.channels[name];
  };

  /**
   * Get a channel by name
   */
  Transport.prototype.getChannel = function(name) {
      return this.channels[name];
  };

  /**
   * Disconnect the transport and close all channels
   */
  Transport.prototype.disconnect = function() {
      var self = this;
      var channelNames = Object.keys(this.channels);
      channelNames.forEach(function(name) {
          self.closeChannel(name);
      });
  };
  return Transport;
});
