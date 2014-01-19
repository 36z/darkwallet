/**
 * @fileOverview Popup classes.
 */

/**
 * Popup class constructor to handle identities.
 * @param {Object} $scope Angular scope.
 * @constructor
 */
function PopupCtrl($scope) {
  $scope.identities = [
    {id: 'gengix'},
    {id: 'sem'}
  ];

  $scope.identityChange = function() {
    if ($scope.identity.id == 'gengix') {
      $scope.activity = [
        {action: 'Received bitcoins', amount: '0.05', timestamp: '5 minutes ago'},
        {action: 'Received bitcoins', amount: '0.01', timestamp: '6 minutes ago'}
      ];
    } else {
      $scope.activity = [
        {action: 'Received bitcoins', amount: '0.1', timestamp: '15 minutes ago'},
        {action: 'Received bitcoins', amount: '2', timestamp: '26 minutes ago'},
        {action: 'Received bitcoins', amount: '0.2', timestamp: '31 minutes ago'}
      ];
    }
  };

  $scope.identity = $scope.identities[0];
  $scope.identityChange();
};


/**
 * Password class constructor.
 * @param {Object} $scope Angular scope.
 * @constructor
 */
function PasswdCtrl($scope) {

  $scope.submit = function() {
    var random = new Uint8Array(16);
    var seed = [];
    var passwd = $scope.passwd;

    $scope.resultShow = true;

    // Check that passwords match.
    if ($scope.passwd != $scope.passwd2) {
      $scope.message = 'Passwords are not the same';
      $scope.pubKey = '';
      $scope.privKey = '';
      return;
    }

    // Fill 'random' array with cryptographically random numbers.
    // Should be done using api from bitcoin-js.
    window.crypto.getRandomValues(random);

    // Copy the random numbers to our seed array.
    // Why is this needed?
    for (var i in random) {
      seed[i] = random[i];
    }

    // Initializing the key from seed.
    // We save the keys so we don't need access to the seed any more.
    seed = Bitcoin.convert.bytesToString(seed);
    var key = new Bitcoin.BIP32key(seed);
    var pubKey = key.getPub().serialize();
    var privKey = key.serialize();

    // Now save in local storage.
    privKey = sjcl.encrypt(passwd, privKey);
    chrome.storage.local.set({pubKey: pubKey});
    chrome.storage.local.set({privKey: privKey});

    // Examples of getting the keys below.
    chrome.storage.local.get('pubKey', function(pubKey){
      // Test and save the pubKey here for now.
      $scope.pubKey = pubKey.pubKey;
      $scope.$apply();
    });

    // Retrieve the privKey.
    chrome.storage.local.get('privKey', function(privKey){
      // Test opening the private key but don't save it.
      $scope.privKey = sjcl.decrypt(passwd, privKey.privKey);
      $scope.$apply();
    });

  };
};
