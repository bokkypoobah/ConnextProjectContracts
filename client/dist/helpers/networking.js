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
exports.GET = 'GET';
exports.POST = 'POST';
class Networking {
    constructor(baseUrl) {
        this.get = (url) => {
            return this.request(url, exports.GET);
        };
        this.post = (url, body) => {
            return this.request(url, exports.POST, body);
        };
        this.request = (url, method, body) => __awaiter(this, void 0, void 0, function* () {
            // TO DO: better type
            const opts = {
                method,
            };
            let res;
            if (method === exports.POST) {
                opts.body = JSON.stringify(body);
                opts.headers = {
                    'Content-Type': 'application/json',
                };
            }
            opts.mode = 'cors';
            opts.credentials = 'include';
            res = yield fetch(`${this.baseUrl}/${url}`, opts);
            if (res.status < 200 || res.status > 299) {
                throw exports.errorResponse(res.status, res.body, `Received non-200 response: ${res.status}`);
            }
            if (res.status === 204) {
                return {
                    data: null,
                };
            }
            const data = yield res.json();
            return {
                data,
            };
        });
        this.baseUrl = baseUrl;
    }
}
exports.Networking = Networking;
exports.errorResponse = (status, body, message) => {
    return {
        status,
        body,
        message,
    };
};
//# sourceMappingURL=networking.js.map