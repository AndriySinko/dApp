// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    function depositFee() external payable;
    function withdrawPrizePool() external returns (uint256);
}
