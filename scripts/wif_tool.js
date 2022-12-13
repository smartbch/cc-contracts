const ethers = require('ethers');

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (process.argv.length < 3) {
    console.log('Usage: node wif_tool.js <wif>');
    return;
  }

  const wif = process.argv[2];
  const base58decoded = Buffer.from(ethers.utils.base58.decode(wif)).toString('hex');
  const privKey = base58decoded.slice(2, base58decoded.length - 10);
  const wallet = new ethers.Wallet(privKey);
  
  console.log('wif    :', wif);
  console.log('privKey:', '0x' + privKey);
  console.log('address:', wallet.address);
}
