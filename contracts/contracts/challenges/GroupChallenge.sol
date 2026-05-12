// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseChallenge.sol";
import "../interfaces/IVerifier.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/ITreasury.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GroupChallenge is BaseChallenge, ReentrancyGuard {
    mapping(address => uint256) public pendingWithdrawals;

    constructor(
        uint256 id,
        address creatorAddr,
        string memory titleStr,
        string memory criteriaStr,
        uint256 joinDl,
        uint256 challengeDl,
        uint256 buyInAmt,
        VerifierType vType,
        address vAddress,
        address repAddress,
        address treasAddress,
        address factoryAddr
    ) {
        require(buyInAmt > 0,              "Buy-in must be positive");
        require(block.timestamp < joinDl,  "Join deadline must be in the future");
        require(joinDl < challengeDl,      "Join deadline must precede challenge deadline");
        require(vAddress     != address(0), "Invalid verifier");
        require(repAddress   != address(0), "Invalid reputation");
        require(treasAddress != address(0), "Invalid treasury");

        challengeId        = id;
        _creator           = creatorAddr;
        title              = titleStr;
        criteria           = criteriaStr;
        _joinDeadline      = joinDl;
        _challengeDeadline = challengeDl;
        _buyIn             = buyInAmt;
        verifierType       = vType;
        verifierAddress    = vAddress;
        reputationAddress  = repAddress;
        treasuryAddress    = treasAddress;
        _state             = ChallengeState.JoinOpen;
        _factory           = factoryAddr;
    }

    function _onVerifyPending() internal virtual override {
        require(_participants.length > 0, "No participants to verify");
        uint256 pLen = _participants.length;
        for (uint256 i = 0; i < pLen; i++) {
            address p = _participants[i];
            IVerifier(verifierAddress).requestVerification(
                address(this),
                p,
                abi.encode(criteria, boundAccount[p])
            );
        }
    }

    function join() external payable {
        require(_state == ChallengeState.JoinOpen, "Challenge not open for joining");
        require(block.timestamp < _joinDeadline, "Join deadline has passed");
        require(!_isRegistered[msg.sender], "Already joined");
        require(msg.value >= _buyIn, "Must send at least buy-in");

        _participants.push(msg.sender);
        _isRegistered[msg.sender] = true;
        _stakes[msg.sender]       = msg.value;

        emit ParticipantRegistered(msg.sender, msg.value, block.timestamp);
    }

    function settle() public virtual override nonReentrant {
        require(_state == ChallengeState.VerifyPending, "Not ready to settle");
        require(_verdictsCompleted == _participants.length, "Not all verdicts received");

        _state = ChallengeState.Settled;

        uint256 pLen = _participants.length;
        uint256 winnersCount;
        uint256 losersCount;
        uint256 totalWinnerStake;
        uint256 loserPot;

        for (uint256 i = 0; i < pLen; i++) {
            address p = _participants[i];
            if (_verdicts[p]) {
                winnersCount++;
                totalWinnerStake += _stakes[p];
            } else {
                losersCount++;
                loserPot += _stakes[p];
            }
        }

        address[] memory repUsers  = new address[](pLen);
        int256[]  memory repDeltas = new int256[](pLen);
        uint256 repCount;

        // All lose
        if (winnersCount == 0) {
            if (loserPot > 0) {
                try ITreasury(treasuryAddress).depositFee{value: loserPot}() {} catch {}
            }
            for (uint256 i = 0; i < pLen; i++) {
                address p = _participants[i];
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
                repUsers[repCount] = p; repDeltas[repCount] = -50; repCount++;
            }
            assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
            try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}
            emit Settled(0, losersCount, 0, loserPot, block.timestamp);
            return;
        }

        // All win
        if (losersCount == 0) {
            uint256 allWinDistributed;
            for (uint256 i = 0; i < pLen; i++) {
                address p = _participants[i];
                pendingWithdrawals[p] += _stakes[p];
                allWinDistributed     += _stakes[p];
                emit ParticipantSettled(p, true, _stakes[p], 0);
                repUsers[repCount] = p; repDeltas[repCount] = 100; repCount++;
            }
            assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
            try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}
            emit Settled(winnersCount, 0, allWinDistributed, 0, block.timestamp);
            return;
        }

        // Mixed
        uint256 fee = (loserPot * 2) / 100;
        uint256 winnerPot = loserPot - fee;

        if (fee > 0) {
            try ITreasury(treasuryAddress).depositFee{value: fee}() {} catch {}
        }

        uint256 totalDistributed;
        for (uint256 i = 0; i < pLen; i++) {
            address p = _participants[i];
            if (_verdicts[p]) {
                uint256 winnings = (_stakes[p] * winnerPot) / totalWinnerStake;
                uint256 payout   = _stakes[p] + winnings;
                pendingWithdrawals[p] += payout;
                totalDistributed      += payout;
                emit ParticipantSettled(p, true, payout, int256(winnings));
                repUsers[repCount] = p; repDeltas[repCount] = 100; repCount++;
            } else {
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
                repUsers[repCount] = p; repDeltas[repCount] = -50; repCount++;
            }
        }

        assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
        try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}

        uint256 dust = winnerPot - (totalDistributed - totalWinnerStake);
        if (dust > 0) {
            try ITreasury(treasuryAddress).depositFee{value: dust}() {} catch {}
        }

        emit Settled(winnersCount, losersCount, totalDistributed, fee + dust, block.timestamp);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
