/**
 * @fileOverview ServersCtrl angular controller
 */
'use strict';

define(['./module', 'darkwallet', 'frontend/port'], function (controllers, DarkWallet, Port) {
  controllers.controller('ServersCtrl', ['$scope', function($scope) {

  $scope.servers = [];
  $scope.newServer = {address: '', name: ''};
  $scope.addServerError = '';
  $scope.connectionStatus = 'Disconnected';
  $scope.servicesStatus = {gateway: 'unknown', obelisk: 'unknown'};

  // Apply scope
  var applyScope = function() {
      if (!$scope.$$phase) {
          $scope.$apply();
      }
  };

  // Track wallet status
  Port.connectNg('wallet', $scope, function(data) {
    if (data.type == 'ready') {
      var identity = DarkWallet.getIdentity();
      $scope.servers = identity.connections.servers;
      $scope.servicesStatus = DarkWallet.core.servicesStatus;
      $scope.selectedServerIdx = identity.connections.selectedServer;
      $scope.selectedServer = identity.connections.servers[$scope.selectedServerIdx];
      applyScope();
    }
  });

  // Track obelisk status
  Port.connectNg('obelisk', $scope, function(data) {
    if (data.type == 'connected') {
      var client = DarkWallet.getClient();
      $scope.connectionStatus = 'Connected';
      applyScope();
    } else
    if (data.type == 'connecting') {
      $scope.connectionStatus = 'Connecting';
      applyScope();
    } else
    if (data.type == 'disconnected') {
      $scope.connectionStatus = 'Disconnected';
      applyScope();
    }
  });

  // Add a server from html form
  $scope.addServer = function() {
      var newServer = $scope.newServer;
      if (!newServer.name || !newServer.address) {
          $scope.addServerError = 'Missing name or address';
          return;
      }
      var identity = DarkWallet.getIdentity();
      var address = newServer.address;
      if (address[0] != 'w') {
          address = 'wss://'+address;
      }
      identity.connections.addServer(newServer.name, address);
      $scope.newServer = {address: '', name: ''};
      $scope.addServerError = '';
  };

  // Connect the given server, triggered by select changing $scope.selectedServerIdx
  $scope.connectServer = function() {
      var identity = DarkWallet.getIdentity();
      $scope.selectedServer = identity.connections.servers[$scope.selectedServerIdx];
      identity.connections.setSelectedServer($scope.selectedServerIdx);
      // Trigger connection
      var addr = identity.connections.getServer($scope.selectedServerIdx);
      DarkWallet.core.connect(addr);
  };

}]);

});

