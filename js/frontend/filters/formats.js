define(['./module', 'bitcoinjs-lib', 'util/btc'], function (filters, Bitcoin, BtcUtils) {

var convert = Bitcoin.convert;

var genesisTime = 1231006505;
var block292399 = 1395744824;

var blockDiff = ((block292399-genesisTime) / 292399);

// Filter for presenting a block height as date
filters.filter('heightToDate', function() {
  return function(input) {
    var ts = (genesisTime+(input*blockDiff))*1000;
    var date = new Date(ts);
    return date.toLocaleDateString();
  };
});


// Filter for presenting a byte array as hex
filters.filter('bytesToHex', function() {
  return function(input) {
    return convert.bytesToHex(input);
  };
});

// Filter for presenting an uncompressed key as compressed address hash
filters.filter('bytesToAddressHash', function() {
  return function(input) {
    if (input.length == 65) {
        var hashed = Bitcoin.Util.sha256ripe160(input);
        var address = Bitcoin.Address(hashed);
        return address.toString();
    } else {
        return convert.bytesToHex(input);
    }
  };
});


});
