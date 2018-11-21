"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const Web3 = require('web3');
const HttpProvider = require(`ethjs-provider-http`);
const Connext_1 = require("./Connext");
// deploy contracts to network
// and update the .env file before testinh
describe('Connext', () => {
    let web3;
    let accounts;
    let connext;
    let partyA;
    before('instantiate web3', () => __awaiter(this, void 0, void 0, function* () {
        web3 = new Web3(new HttpProvider('http://localhost:8545'));
        accounts = yield web3.eth.getAccounts();
        partyA = accounts[1];
        // instantiate client
        connext = new Connext_1.Connext({
            web3,
            hubUrl: process.env.HUB_URL || '',
            contractAddress: process.env.CONTRACT_ADDRESS || '',
            hubAddress: process.env.HUB_ADDRESS || '',
            tokenAddress: process.env.TOKEN_ADDRESS,
        });
    }));
    // it('should recover the signer from the channel update', async () => {
    //   const userBalance = {
    //     weiBalance: new BN('10').toString(),
    //     tokenBalance: new BN('10').toString(),
    //   }
    //   const hubBalance = {
    //     weiBalance: '0',
    //     tokenBalance: '0',
    //   }
    //   // create update sig
    //   const updatedChannel = await connext.createChannelStateUpdate(
    //     userBalance,
    //     hubBalance,
    //     'ProposePending', // reason
    //     30, // period in s
    //     null, // exchange rate
    //     null, // meta
    //     partyA, // user aka signer
    //   )
    //   console.log('updatedChannel:2::', updatedChannel)
    //   const signer = Connext.utils.recoverSignerFromChannelStateUpdate(
    //     updatedChannel,
    //     updatedChannel.sigUser,
    //   )
    //   console.log(signer)
    //   expect(signer.toLowerCase()).to.equal(partyA.toLowerCase())
    //   // signer should be partyA
    //   // create an update to sign
    // })
});
//# sourceMappingURL=Connext.test.js.map