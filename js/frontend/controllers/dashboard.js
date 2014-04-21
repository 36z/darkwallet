'use strict';

define(['./module', 'darkwallet'], function (controllers, DarkWallet) {
  controllers.controller('DashboardCtrl', ['$scope', function($scope) {
    $scope.dashboard = {};
    var identity = DarkWallet.getIdentity();
    $scope.dashboard.address = identity.wallet.getFreeAddress(0).address;
  }]);
});