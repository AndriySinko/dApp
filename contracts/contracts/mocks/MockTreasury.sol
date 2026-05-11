// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ITreasury.sol";

contract MockTreasury is ITreasury {
    uint256 public totalDeposited;

    function depositFee() external payable override {
        totalDeposited += msg.value;
    }

    function withdrawPrizePool(address recipient, uint256 amount) external override {
        (bool ok,) = payable(recipient).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function prizePool() external view override returns (uint256) {
        return address(this).balance;
    }

    function authorizeChallenge(address) external override {}

    receive() external payable {}
}
