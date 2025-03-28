// scripts/mint-test-tokens.js
const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xb76955B254240D3441291E034b42578c89Cb8477";
  const recipientAddress = "0x4a7Cb3cA89721f3396CfeA250B71644452a38633";
  const amount = hre.ethers.utils.parseUnits("100", 6); // 100 tokens with 6 decimals
  
  const Token = await hre.ethers.getContractFactory("TestUSDT");
  const token = await Token.attach(tokenAddress);
  
  console.log(`Minting ${amount} tokens to ${recipientAddress}...`);
  await token.transfer(recipientAddress, amount);
  console.log("Tokens minted successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });