const HDWalletProvider = require("truffle-hdwallet-provider");

const mnemonic = 'fetch local valve black attend double eye excite planet primary install allow'

module.exports = {
  networks: {
    mainnet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1",
      gas: 4700000
    },
    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "4447",
      gas: 6721975
    },
    development: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "4447",
      gas: 4700000
    },
    rinkeby: {
      provider: function () {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/M2xeaVefzxkLhvrTLq43")
      },
      network_id: 2,
      gas: 7200000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 1
    }
  },
  mocha: {
    enableTimeouts: false
  }
};

// LOCAL

/*
Available Accounts
==================
(0) 0xfb482f8f779fd96a857f1486471524808b97452d (~100 ETH)
(1) 0x2da565caa7037eb198393181089e92181ef5fb53 (~100 ETH)
(2) 0x8644406d56e3950975f10d063241208016f4b56f (~100 ETH)
(3) 0xc77f221e270ae13c5095d03047199d41b69c9f78 (~100 ETH)
(4) 0x98788265186c69d05648556a62279b572435170e (~100 ETH)
(5) 0x05ef57dd7670e0fca5bfa8c4c834bfb0bb95a9e0 (~100 ETH)
(6) 0x81c7dc2be16eef877779f63b33d22282e48ca15d (~100 ETH)
(7) 0x17b105bcb3f06b3098de6eed0497a3e36aa72471 (~100 ETH)
(8) 0x64d3c7c65ff1182ea882292a0012ed0ef74fcaaf (~100 ETH)
(9) 0x76fc3fe47393462c430108518080af400cf10dc4 (~100 ETH)

Private Keys
==================
(0) 0x09cd8192c4ad4dd3b023a8ef381a24d29266ebd4af88ecdac92ec874e1c2fed8
(1) 0x54dec5a04356ed96fc469803f3e45b901c69c5d5fd93a34fbf3568cd4c6efadd
(2) 0xa42d981869266bbb39aa894966f6430a85c2ed12836328fe23e403031f1a92b6
(3) 0xf1815522b81f88cf1ed7e232471012672f7f1144f5fd32136ecbcc2307fd3f0b
(4) 0x628ccc1a8fa5478fbd034d0bb964d1e05376710a3d14e8643deb5db37fd62243
(5) 0x31e7320fab7e4904be67562299bf098e44ed1a6c50132dd51ee83c33f1e9ea7b
(6) 0x40805dd14c3e361603a10198d25820235e8f237c182106f6d51d8fb364de4327
(7) 0x0aba2a064ba9dedf2eb7623e75b7701a72f21acbdad69f60ebaa728a8e00e5bb
(8) 0xa76d14d7fbbf2868ebd9580305aec6461319b2f261c7a75b0763c79165b41ec2
(9) 0xb75be88ddb9f86f4a21d168cde7ea35bca73b7d550075171498427d8334f5dc9
*/

// RINKEBY

/*
Available Accounts
==================
(0) 0x8ec75ef3adf6c953775d0738e0e7bd60e647e5ef
(1) 0x9a8d670c323e894dda9a045372a75d607a47cb9e
(2) 0xa76f1305f64daf03983781f248f09c719cda30bf
(3) 0xe4cbacbf76d1120dfe78b926fbcfa6e5bc9917a1
(4) 0x6fab42068c1eedbcbd3948b1cddef1eef1249825
(5) 0xacc361b5b7f3bbda23ea044b3142dcc6b76ec708
(6) 0xecd03eb3951705da1b434fcf0da914268b687e3d
(7) 0x1754e4007922865fb09349897524ee2dd63ac184
(8) 0x6fec9dda7a05f9e45601d77a0f1e733c821a02d8
(9) 0x778e55d7517b5278399d41f4a89f78418154297b

Private Keys
==================
(0) f0f18fd1df636821d2d6a04b4d4f4c76fc33eb66c253ae1e4028bf33c48622bc
(1) 1ee927be212d11c388af6f0a11e66ab2fb054193ed50b6c1b457e2b80ab45b67
(2) cf218d8691b038086126d98f91297e608f9e2aa1fdd5ba2cfce41eab2887ed76
(3) 33e495d9693e612f87b80e2d202e910e36a5e416a0368d93b9e756a2b5668836
(4) 53efc621d7b1b9386b7ca95067f3082de9d0e1024600363ae38465a2ce6af4e3
(5) 2b1f640a724e13ee80041636ff6acf4f980b63cc609bc5d9d94c80f1d45bab5c
(6) dbd5dd1198c75025a66982abcc8892f3abfb31db35e677005e93d383e615c2cf
(7) 874bc239731735873dd55edebc6e14764ce1e08ed45e1f52c80d53721c961152
(8) 48ab1dc0428e4cd7ad5a63987d3da4561d7f0599462ecddba82e382a60b249aa
(9) eef8d4482cf4bb3b6f70f7b91f19545a73f6e3bb27d54f6a78ad49a57ed70483

HD Wallet
==================
Mnemonic:      `fetch local valve black attend double eye excite planet primary install allow`
Base HD Path:  m/44'/60'/0'/0/{account_index}

*/