// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITreasury} from "../interfaces/ITreasury.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Treasury is ITreasury, Ownable {
    uint256 private _prizePool;
    mapping(address => bool) authorized;

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    event FeeReceived(address indexed challenge, uint256 amount, uint256 timestamp);
    event PrizePoolUpdated(uint256 newTotal);

    function authorize(address caller) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorized[caller] = true;
    }

    function deauthorize(address caller) external onlyOwner {
        authorized[caller] = false;
    }

    function prizePool() external view override returns (uint256) {
        return _prizePool;
    }

    function depositFee() external payable override {
        require(msg.value > 0, "Must send some ether");
        _prizePool += msg.value;
        emit FeeReceived(msg.sender, msg.value, block.timestamp);
        emit PrizePoolUpdated(_prizePool);
    }

    function withdrawPrizePool(address recipient, uint256 amount) external onlyAuthorized override {
        require(recipient != address(0), "Zero address");
        require(amount <= _prizePool, "Insufficient prize pool");
        _prizePool -= amount;
        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "Transfer failed");
        emit PrizePoolUpdated(_prizePool);
    }

    function sweep(address recipient) external onlyOwner {
        require(recipient != address(0), "Zero address");
        uint256 amount = _prizePool;
        _prizePool = 0;
        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "Transfer failed");
        emit PrizePoolUpdated(_prizePool);
    }
}
