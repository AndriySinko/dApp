// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ERC-20 stub with configurable per-address balances.
// Used to mocks OnChainVerifier's "erc20:addr:amount" criteria.
contract MockERC20Balance {
    mapping(address => uint256) private _balances;

    function setBalance(address account, uint256 amount) external {
        _balances[account] = amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
}
