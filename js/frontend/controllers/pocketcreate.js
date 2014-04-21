/**
 * @fileOverview PocketCreateCtrl angular controller
 */
'use strict';

define(['./module', 'darkwallet'], function (controllers, DarkWallet) {
  controllers.controller('PocketCreateCtrl', ['$scope', function($scope) {

    /**
     * Scope variables
     */
    $scope.newPocket = {};
    $scope.creatingPocket = false;


    /**
     * Create a pocket
     */
    $scope.createPocket = function() {
        if ($scope.creatingPocket && $scope.newPocket.name) {
            var identity = DarkWallet.getIdentity();

            // create pocket
            identity.wallet.pockets.createPocket($scope.newPocket.name);
            var pocketIndex = identity.wallet.pockets.hdPockets.length-1;

            // initialize pocket on angular
            $scope.initPocket(pocketIndex);

            // generate an address
            $scope.generateAddress(pocketIndex*2, 0);

            // select the pocket
            $scope.selectPocket($scope.newPocket.name, pocketIndex);

            // reset pocket form
            $scope.newPocket = {name:''};
        }
        $scope.creatingPocket = !$scope.creatingPocket;
    };

    /**
     * Rename a pocket
     */
    $scope.finalizeRenamePocket = function(pocket) {
        if (!pocket || !pocket.name) {
            // if empty just toggle visibility
            $scope.forms.pocketLabelForm.$show();
        } else {
            var identity = DarkWallet.getIdentity();
            identity.store.save();
            $scope.pocket.name = pocket.name;
        }
    };

}]);
});
