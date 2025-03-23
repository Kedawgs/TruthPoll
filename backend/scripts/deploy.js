// scripts/deploy.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("Starting deployment process...");
    
    // Get USDT address from env
    const usdtAddress = process.env.USDT_ADDRESS;
    
    if (!usdtAddress) {
      throw new Error("USDT_ADDRESS not set in environment variables");
    }
    
    console.log("Using USDT address:", usdtAddress);
    
    // 1. Deploy SmartWalletFactory
    console.log("Deploying SmartWalletFactory...");
    const SmartWalletFactory = await hre.ethers.getContractFactory("SmartWalletFactory");
    const smartWalletFactory = await SmartWalletFactory.deploy();
    await smartWalletFactory.deployed();
    console.log("SmartWalletFactory deployed to:", smartWalletFactory.address);
    
    // 2. Deploy PollFactory
    console.log("Deploying PollFactory...");
    const PollFactory = await hre.ethers.getContractFactory("PollFactory");
    const pollFactory = await PollFactory.deploy(usdtAddress);
    await pollFactory.deployed();
    console.log("PollFactory deployed to:", pollFactory.address);
    
    // Save addresses to .env.local
    const envLocalPath = path.join(__dirname, '..', '.env.local');
    const envData = `SMART_WALLET_FACTORY_ADDRESS=${smartWalletFactory.address}\nFACTORY_ADDRESS=${pollFactory.address}\n`;
    
    fs.writeFileSync(envLocalPath, envData);
    console.log("Contract addresses saved to .env.local file");
    console.log("Please update your main .env file with these addresses");
    
    return {
      smartWalletFactoryAddress: smartWalletFactory.address,
      pollFactoryAddress: pollFactory.address
    };
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });