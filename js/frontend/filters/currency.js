define(['./module', 'darkwallet', 'util/fiat'], function (filters, DarkWallet, FiatCurrencies) {

// Convert input to btc units
var getAsBtc = function(currency, input) {
  if (currency == 'mbtc') {
    return input / 100000;
  } else {
    return input / 100000000;
  }
}

// Filter for presenting a satoshi amount into selected btc unit
filters.filter('currencyFilter', function() {
  return function(input) {
    var identity = DarkWallet.getIdentity();
    return getAsBtc(identity.settings.currency, input);
  };
});

// Filter for presenting a satoshi amount into selected btc unit with unit label
filters.filter('currencyPresenter', function() {
  return function(input) {
    var identity = DarkWallet.getIdentity();
    var walletService = DarkWallet.service().getWalletService();
    var rate = walletService.rates[identity.settings.fiatCurrency];
    var formatted = getAsBtc(identity.settings.currency, input);
    if (identity.settings.currency == 'mbtc') {
      formatted += ' mBTC';
    } else {
      formatted += ' BTC';
    }

    if (rate) {
      var converted = (input * rate / 100000000).toFixed(2);
      var currency = FiatCurrencies[identity.settings.fiatCurrency];
      formatted += " ("+converted+" "+currency.symbol+")";
    }

    return formatted;
  };
});

});
