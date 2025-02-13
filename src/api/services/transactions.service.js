//const libStripe = require('../../lib/stripe');
const libPlaid = require('../../lib/plaid');
const libChargeable = require('../../lib/chargeable');
const Chargeable = require('../interfaces/Chargeable');
const libTransformable = require('../../lib/transformable');
const Transformable = require('../interfaces/Transformable');
const transformable = new Transformable(libTransformable);
const chargeable = new Chargeable(libChargeable);
const eventEmitter = require('../../lib/events');
const { findOneBy, findSponsorTransactions } = require('../../lib/mixins');
const Repository = require('../interfaces/Repository');
const libRepository = require('../../lib/repository');
const startDate = '2020-05-01';
const endDate = '2020-07-01';
const repo = Object.assign(new Repository(libRepository), {
    findOneBy,
    findSponsorTransactions
});
repo.connect({
    host: process.env.DATA_SERVICE_HOST,
    defaultPath: '/api/sponsor_plaid_credentials'
})

eventEmitter.on('webhooks.transactionsUpdateAvailable', onTransactionsUpdateAvailable);

/** Handles the `webhooks.transactionsUpdateAvailable` event
 * @param {String} itemId - itemId associated with the transaction from Plaid
 */

async function onTransactionsUpdateAvailable(itemId) {
    const transactions = await getUpdatedTransactions(itemId);
    const roundUps = await getTransactionRoundups(transactions);
    const [record] = await repo.findOneBy('item_id', itemId);
    const { sponsor_id } = record;

    //**ENABLING STRIPE INTEGRATION IN PLAID API REQUIRED TO COMPLETE PAYMENT FLOW**
    /*See docs: 
        https://stripe.com/docs/ach
        https://stackoverflow.com/questions/46112761/error-in-plaid-api
        https://fin.plaid.com/articles/inside-ach-payments-with-stripe-and-plaid
        https://stripe.com/docs/api
    
    const result = await libPlaid.client.getAccounts(record.access_token);
    const myAccountId = result.accounts[0]['account_id'];
    const myStripeToken = await libPlaid.client.createStripeToken(record.access_token, myAccountId);
    Create Stripe charges for each amount in the list, example of one charge below
    await libStripe.client.charges.create({
        amount: Number(`.${roundUps[0]}`),
        currency: 'usd',
        source: myStripeToken
    });*/

    const pendingChargesList = roundUps.map((amt) => {
        return chargeable.of({ amount: Number(`.${amt}`) }).createCharge()
    });
    const completedCharges = await Promise.all(pendingChargesList);
    const recordedCharges = completedCharges.map((tx) => {
        const { id, amount, createdAt, } = tx;
        return repo.addOne.call({ connectionURI: `${process.env.DATA_SERVICE_HOST}/api/sponsor_transactions` }, { id, amount, createdAt, sponsor_id });
    });

    await Promise.all(recordedCharges);
}

/** Fetches the latest transactions for a specified 
 * @param {String} itemId - itemId associated with the transaction from Plaid
 */

async function getUpdatedTransactions(itemId) {
    const [record] = await repo.findOneBy('item_id', itemId);
    const plaidAccessToken = record.access_token;
    //TODO: Parameterize `startDate` and `endDate`
    const { transactions } = await libPlaid.client.getTransactions(plaidAccessToken, startDate, endDate);

    return transactions;
}

/** Computes and returns the amount of the roundups for a list of transactions.
 * @param {String} txList - A list of Plaid `transaction` objects
 * @return {Object}
 */

async function getTransactionRoundups(txList) {
    const roundUps = txList.map(({ amount }) => amount.toString())
        .filter((value) => !value.includes('-') && value.includes('.'))
        .map((value) => 100 - (value.slice(value.lastIndexOf('.') + 1)));

    return roundUps;
}

/** Get all transactions for a specified sponsor
 * @param {String} id - uuid of the `Sponsor`
 * @return {Object}
 */

async function getTransactionsBySponsorId(id) {
    const transactionsList = await repo.findSponsorTransactions.call({
        connectionURI: `${process.env.DATA_SERVICE_HOST}/api/xjoin`
    }, id);
    return transactionsList.map((tx) => transformable.of({ type: 'transaction' }, tx));
}

module.exports = {
    getUpdatedTransactions,
    getTransactionRoundups,
    getTransactionsBySponsorId
}