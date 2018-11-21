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
const Utils_1 = require("./Utils");
const Validation_1 = require("./Validation");
describe('Validation', () => {
    let web3;
    let accounts;
    const utils = new Utils_1.Utils();
    const validation = new Validation_1.Validation();
    let user, hubAddress, receiver;
    before('instantiate web3', () => __awaiter(this, void 0, void 0, function* () {
        // instantiate web3
        web3 = new Web3(new HttpProvider('http://localhost:8545'));
        // set default account values
        accounts = yield web3.eth.getAccounts();
        hubAddress = accounts[0];
        user = accounts[1];
        receiver = accounts[2];
    }));
    it('should correctly validate a payment update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate an exchange update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate a proposed pending deposit update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate a confirm pending deposit update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate a proposed pending withdrawal update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate a confirm pending withdrawal update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate an open thread update', () => __awaiter(this, void 0, void 0, function* () { }));
    it('should correctly validate a close thread update', () => __awaiter(this, void 0, void 0, function* () { }));
});
//# sourceMappingURL=validation.test.js.map