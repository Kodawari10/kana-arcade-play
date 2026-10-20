/*
 * Kana Arcade: Starknet settings (optional layer).
 * After deploying the badge contract (see contracts/README.md), paste its address into `contractAddress`.
 * While `contractAddress` is empty, players can still connect a wallet, but minting stays off.
 *
 * Cartridge (via StarkZap): social / passkey login with session policies limited to the badge contract's
 * `claim` / `claim_batch`, and feeMode { type: "paymaster" } so stamps are free where sponsorship is
 * configured (falls back to user_pays). Extension wallets (Ready, Braavos) are available too.
 */
window.KA_STARKNET_CONFIG = {
  enabled: true,                               // set to false to hide every Starknet button
  network: 'sepolia',
  networkName: 'Sepolia testnet',
  chainId: '0x534e5f5345504f4c4941',           // SN_SEPOLIA
  rpcUrl: 'https://starknet-sepolia.drpc.org',  // any Starknet JSON-RPC (v0.8+) endpoint for Sepolia
  contractAddress: '',                         // <- paste the deployed KanaBadges address here
  explorerTx: 'https://sepolia.voyager.online/tx/',
  explorerContract: 'https://sepolia.voyager.online/contract/',
  explorerNft: 'https://sepolia.voyager.online/nft/',      // + <contract>/<tokenId>
  batchSize: 32,                               // all 32 badges fit in one claim_batch
  cartridge: {
    enabled: true,
    feeMode: { type: 'paymaster' },            // current StarkZap API ("sponsored" is the deprecated alias)
    fallbackFeeMode: 'user_pays',              // used if paymaster / SNIP-9 sponsorship isn't available
    deploy: 'if_needed',
    methods: ['claim', 'claim_batch'],         // session policies: only these entrypoints
    // preset: 'kana-arcade',                  // Cartridge dashboard preset name, if you create one
  },
  installLinks: [
    { name: 'Ready', url: 'https://www.ready.co/' },
    { name: 'Braavos', url: 'https://braavos.app/' }
  ]
};
