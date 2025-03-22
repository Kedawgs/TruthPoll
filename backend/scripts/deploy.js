const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    // Get the contract factory
    const PollFactory = await hre.ethers.getContractFactory("PollFactory");
    
    // Deploy the contract
    console.log("Deploying PollFactory...");
    const pollFactory = await PollFactory.deploy();
    
    // Wait for deployment to finish
    await pollFactory.deployed();
    
    console.log("PollFactory deployed to:", pollFactory.address);
    
    // Save the address to a .env.local file
    const envLocalPath = path.join(__dirname, '..', '.env.local');
    const envData = `FACTORY_ADDRESS=${pollFactory.address}\n`;
    
    fs.writeFileSync(envLocalPath, envData, { flag: 'a' });
    console.log("Factory address saved to .env.local file");
    console.log("Make sure to update your main .env file with this address");
    
    return pollFactory.address;
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });