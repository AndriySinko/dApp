// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal ERC-20 stub for testing LINK-related logic.
// All transfer/approve operations succeed unconditionally.
contract MockERC20 {
    function transferFrom(address, address, uint256) external pure returns (bool) { return true; }
    function transfer(address, uint256)              external pure returns (bool) { return true; }
    function approve(address, uint256)               external pure returns (bool) { return true; }
    function allowance(address, address)             external pure returns (uint256) { return type(uint256).max; }
    function balanceOf(address)                      external pure returns (uint256) { return type(uint256).max; }
}
