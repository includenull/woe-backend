const banlist = {
  // scam tokens, don't track them at all (won't exists on platform)
  scam_contracts: [
    'token.rich',
    'createtokens',
    'getweedtoken',
    'pornhubgames',
    'waxthanhdat1',
    'awesomemoney',
    'onlyrocketss',
    'juvenales222',
    'factorytoken',
    'testwaxtoken',
    'usdcoinchain',
    'onfederation',
    'martaintoken',
    'martiantoken',
    'superruncoin',
    'machine.army', // not sure
    'gemlandcoins', // not sure
    'junkoqwertyu',
    'almightytokn', // block people from selling
    'okbtothemoon',
    'huobideposit',
    'binancecleos',
    'kucoindoteos',
    'eosbndeposit',
    'bosibc.io',
    'betdividends', // BET token transfer blocked for migration - "BET token paused. Upgrade to EBET token on EarnBet.io"
    'rorgametoken', // Dead project (AH: rorgameworld) - Not possible to buy with error "Only rorgame owner can transfer"
    'loopbttokens', // Dead project (AH: loopbattleio) - Not possible to buy with error "transfer between account disabled"
    //'orderofomnis', // Contract has been removed from account
    'seeds.pet', // Contract has been removed
    'dinounivtoks',
    'metavillagec', // rugpulled, contracts removed
    'lemon11token', // Account is not credited of tokens after transfer action even if a contract is deployed
    'starcadiatok', // contract removed for the third time. has been warned several times already
    'hotwallet.gm',
    'bullwaxtoken',
    'memewaxtoken',
    'starcadiamlk',
    'gildgearz.gm',
    'exominetoken',
    'tempestgame1', // removed twice, do not remove again
    'worldcrashtk',
    'factorycoins',
    'bigsteppa.gm',
    'underwtokens',
    'cinematokflm',
    'truckerbucks',
    'waxmaftoken1',
    'wrecktiumtok',
    'fbirdstokens',
    'zoocoinplntt',
    'kleeblatt.gm',
    'theopentoken', // rugged, minted 1000x max supply and dumped all
    'tokenanimal1', // void contract
    'deadcitytokn', // void contract
    'mammothtoken', // void contract
    'tokenseeker1', // void contract
    'dyoq4.c.wam',  // void contract
    'xpressive111', // void contract
    'newlive.gm',   // void contract
  ],
}

export default banlist;