import {
  RPCSubprovider,
  Web3ProviderEngine,
  MnemonicWalletSubprovider
} from "@0x/subproviders";
import {
  ContractWrappers,
  BigNumber,
  generatePseudoRandomSalt,
  signatureUtils,
  assetDataUtils
} from "0x.js";
import { Web3Wrapper } from "@0x/web3-wrapper";
import { OrderWatcher } from "@0x/order-watcher";

var providerEngine,
  web3Wrapper,
  contractWrappers,
  makerAddress,
  takerAddress,
  orderWatcher,
  index,
  makerAssetData,
  takerAssetData;
var results = [[]];
var resultsBlock = [];
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

async function constructor() {
  providerEngine = new Web3ProviderEngine();

  var key = new MnemonicWalletSubprovider({
    mnemonic:
      "MNEMONIC_HERE"
  });
  providerEngine.addProvider(key);
  providerEngine.addProvider(
    new RPCSubprovider(
      "https://eth-ropsten.alchemyapi.io/API_KEY_HERE"
    )
  );

  var address = await key.getAccountsAsync(3);
  providerEngine.start();

  web3Wrapper = new Web3Wrapper(providerEngine);

  contractWrappers = new ContractWrappers(providerEngine, {
    networkId: 3
  });
  orderWatcher = new OrderWatcher(providerEngine, 3);
  orderWatcher.subscribe(async (err, orderState) => {
    results[index].push({
      date: new Date().getTime(),
      block: await web3Wrapper.getBlockNumberAsync()
    });
    orderWatcher.removeOrder(orderState.orderHash);
  });

  makerAddress = address[1];
  takerAddress = address[2];
  makerAssetData = assetDataUtils.encodeERC20AssetData(
    "0xc778417e063141139fce010982780140aa0cd5ab"
  );
  takerAssetData = assetDataUtils.encodeERC20AssetData(
    "0xff67881f8d12f372d91baae9752eb3631ff0ed00"
  );
  start();
}

function getFinalResults() {
  console.log("----Final results----");
  var finalTotal = 0;
  for (var x = 0; x < results.length - 1; x++) {
    var total = 0;
    var blocks = "Callbacks: ";
    for (var z = 0; z < results[x].length; z++) {
      if (z !== results[x].length - 1) {
        total += results[x][z + 1].date - results[x][z].date || 0;
      }
      blocks += "/" + results[x][z].block;
    }
    var mediana = total / results[x].length;
    finalTotal += mediana;
    console.log("-----");
    console.log("Average time between callbacks: " + mediana);
    console.log("Blocks where callbacks are done: " + blocks);
    console.log("-----");
  }
  console.log("Global average: " + finalTotal / results.length);
}
function start() {
  index = 0;
  var last = new Date().getTime() + 1800000;
  createAndFill();
  var intervalo = setInterval(() => {
    if (results[index].length === 5 && last > new Date().getTime()) {
      results.push([]);
      index++;
      console.log("*New interval! " + index);
      createAndFill();
    } else if (last < new Date().getTime()) {
      getFinalResults();
      clearInterval(intervalo);
    }
  }, 1000);
}
async function createAndFill() {
  var exchangeAddress = contractWrappers.exchange.address;
  var arrayOrders = [];
  try {
    for (var i = 0; i < 5; i++) {
      var order = {
        exchangeAddress,
        makerAddress,
        takerAddress: NULL_ADDRESS,
        senderAddress: NULL_ADDRESS,
        feeRecipientAddress: NULL_ADDRESS,
        expirationTimeSeconds: new BigNumber(
          Math.round(new Date().getTime() / 1000.0) + 1800
        ),
        salt: generatePseudoRandomSalt(),
        makerAssetAmount: new BigNumber(10000000000000),
        takerAssetAmount: new BigNumber(10000000000000),
        takerAssetData,
        makerAssetData,
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0)
      };
      var signedOrder = await signatureUtils.ecSignOrderAsync(
        providerEngine,
        order,
        makerAddress
      );
      await orderWatcher.addOrderAsync(signedOrder);
      arrayOrders.push(signedOrder);
    }
    var tx = await contractWrappers.exchange.batchFillOrdersAsync(
      arrayOrders,
      [
        new BigNumber(10000000000000),
        new BigNumber(10000000000000),
        new BigNumber(10000000000000),
        new BigNumber(10000000000000),
        new BigNumber(10000000000000)
      ],
      takerAddress
      // { gasLimit: 700000, gasPrice: new BigNumber(20000000000) }
    );
    var bl = await web3Wrapper.awaitTransactionMinedAsync(tx);
    // console.log(bl);
    resultsBlock.push(bl.blockNumber);
  } catch (err) {
    console.log(err);
  }
}

constructor();
