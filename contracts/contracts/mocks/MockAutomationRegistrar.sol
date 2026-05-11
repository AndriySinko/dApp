// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Stub for Chainlink Automation Registrar — records calls and returns incrementing IDs.
contract MockAutomationRegistrar {
    struct RegistrationParams {
        string  name;
        bytes   encryptedEmail;
        address upkeepContract;
        uint32  gasLimit;
        address adminAddress;
        uint8   triggerType;
        bytes   checkData;
        bytes   triggerConfig;
        bytes   offchainConfig;
        uint96  amount;
    }

    uint256 public callCount;
    address public lastUpkeepContract;

    function registerUpkeep(RegistrationParams calldata params) external returns (uint256) {
        callCount++;
        lastUpkeepContract = params.upkeepContract;
        return callCount;
    }
}
