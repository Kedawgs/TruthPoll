// scripts/mint-test-tokens.js
const hre = require("hardhat");

async function main() {
  const tokenAddress = "0x7111e579F91D7171E2EecCBF7fA24DA272EfFC31";
  const recipientAddress = "0x84fB198368e97D347b143e63D2E3A0A9240B406b";
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