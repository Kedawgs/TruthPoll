const hre = require("hardhat");

async function main() {
  console.log("Deploying Test USDT token...");
  
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Deploy the TestUSDT contract
  const TestUSDT = await hre.ethers.getContractFactory("TestUSDT");
  const testUSDT = await TestUSDT.deploy(deployer.address);
  
  await testUSDT.deployed();
  
  console.log("Test USDT deployed to:", testUSDT.address);
  console.log("Remember to add this address to your .env file as REACT_APP_USDT_ADDRESS");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });