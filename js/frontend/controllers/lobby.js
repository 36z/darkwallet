define(['./module', 'darkwallet', 'frontend/services', 'frontend/channel_link', 'bitcoinjs-lib', 'util/protocol'],
function (controllers, DarkWallet, Services, ChannelLink, Bitcoin, Protocol) {
  'use strict';

  controllers.controller('LobbyCtrl', ['$scope', 'toaster', function($scope, toaster) {

  var transport, currentChannel;

  // Link a channel with this scope by name
  var channelLinks = {};
  var linkChannel = function(name) {
      var channelLink;
      if (channelLinks.hasOwnProperty(name)) {
          // Channel is already linked
          channelLink = channelLinks[name];
      } else {
          // Totally new channel, subscribe
          channelLink = new ChannelLink(name, $scope);
          channelLinks[name] = channelLink;
          channelLink.addCallback('subscribed', function() {
              toaster.pop('success', 'channel', 'subscribed successfully')
              channelLink.channel.sendOpening();
          })
          channelLink.addCallback('Contact', function(data) {
              toaster.pop('success', 'contact', data.body.name)
              var peer = channelLink.channel.getPeer(data.sender)
              $scope.newContact = data.body;
              $scope.newContact.pubKeyHex = peer.pubKeyHex;
              $scope.newContact.fingerprint = peer.fingerprint;
          })
          channelLink.addCallback('Shout', function(data) {
              var peer = channelLink.channel.getPeer(data.sender)
              var channel = channelLink.channel;

              // add user pubKeyHex to use as identicon
              if (peer) {
                  data.pubKeyHex = peer.pubKeyHex;
              } else {
                  // lets set a dummy hex code for now
                  data.pubKeyHex = "deadbeefdeadbeefdeadbeef";
              }

              // add to channel shoutbox
              if (!$scope.shoutboxLogAll.hasOwnProperty(channel.channelHash)) {
                  $scope.shoutboxLogAll[channel.channelHash] = [];
              }
              $scope.shoutboxLogAll[channel.channelHash].push(data)

              // show toaster note
              if (data.sender == channel.fingerprint) {
                  toaster.pop('success', 'me', data.body.text)
              } else {
                  toaster.pop('note', data.sender.slice(0,12), data.text)
              }
              if (!$scope.$$phase) {
                  $scope.$apply();
              }
          })
      }
      $scope.subscribed = channelLink.channel.channelHash;
      currentChannel = channelLink.channel;
      return channelLink;
  }

  // Lobby service port
  Services.connectNg('lobby', $scope, function(data) {
    // onMesssage callback
    console.log("[LobbyCtrl] Message", data);
    if (data.type == 'initChannel') {
        linkChannel(data.name);
    }
  }, function(port) {
    // onCreate callback
    transport = DarkWallet.getLobbyTransport();

    $scope.lobbyChannels = transport.channels;

    $scope.pairCode = '';
    $scope.subscribed = false;
    $scope.shoutbox = '';
    $scope.shoutboxLog = [];
    $scope.shoutboxLogAll = {};

    // Initialize some own data
    $scope.comms = transport.comms;
    $scope.myself = transport.myself;
    $scope.peers = transport.peers;
    $scope.peerIds = transport.peerIds;
    $scope.requests = transport.requests;

    // Initialize a channel
    var connectChannel = function(name) {
        var pairCodeHash = transport.hashChannelName(name);

        // Prepare channel view
        if (!$scope.shoutboxLogAll.hasOwnProperty(pairCodeHash)) {
            $scope.shoutboxLogAll[pairCodeHash] = [];
        }
        $scope.shoutboxLog = $scope.shoutboxLogAll[pairCodeHash];

        if (transport.getChannel(name)) {
            // Channel exists, relink
            linkChannel(name);
        } else {
            // Create if it doesn't exist
            ChannelLink.start(name, port);
        }
        $scope.subscribed = pairCodeHash;
        }

    $scope.selectChannel = function(channel) {
        // Relink
        connectChannel(channel.name);
        if (currentChannel) {
            currentChannel.sendOpening();
        }
    }

    // Action to start announcements and reception
    $scope.joinChannel = function() {
        connectChannel($scope.pairCode);
    }
    $scope.selectPeer = function(peer) {
        $scope.selectedPeer = peer;
    }
    $scope.pairPeer = function(peer) {
        $scope.selectedPeer = peer;
        var identity = DarkWallet.getIdentity();
        var msg = Protocol.ContactMsg(identity);
        currentChannel.postDH(peer.pubKey, msg, function() {
            toaster.pop("success", "lobby", "pairing sent");
        });
    }
    $scope.sendText = function() {
        var toSend = $scope.shoutbox;
        $scope.shoutbox = '';
        currentChannel.postEncrypted(Protocol.ShoutMsg(toSend), function(err, data) {
          if (err) {
              toaster.pop('error', "error sending " + err)
          }
        });
    }
    $scope.addNewContact = function(contact) {
        var identity = DarkWallet.getIdentity();
        var newContact = {name: contact.name, address: contact.stealth, fingerprint: contact.fingerprint};
        identity.contacts.addContact(newContact)
        $scope.newContact = null;
        toaster.pop('success', 'Contact added')
    }
    if(!$scope.$$phase) {
        $scope.$apply();
    }
  });
}]);
});
