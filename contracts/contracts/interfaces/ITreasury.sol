// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    function depositFee() external payable;
    function withdrawPrizePool(address recipient, uint256 amount) external;
    function prizePool() external view returns (uint256);
}
