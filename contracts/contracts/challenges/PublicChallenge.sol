// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GroupChallenge.sol";

contract PublicChallenge is GroupChallenge {
    uint256 _prizePool;

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
    ) payable GroupChallenge(
        id, creatorAddr, titleStr, criteriaStr,
        joinDl, challengeDl, buyInAmt,
        vType, vAddress, repAddress, treasAddress, factoryAddr
    ) {
        require(msg.value > 0, "Prize pool required");
        _prizePool = msg.value;
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
            uint256 totalPool = loserPot + _prizePool;
            if (totalPool > 0) {
                try ITreasury(treasuryAddress).depositFee{value: totalPool}() {} catch {}
            }
            for (uint256 i = 0; i < pLen; i++) {
                address p = _participants[i];
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
                repUsers[repCount] = p; repDeltas[repCount] = -50; repCount++;
            }
            assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
            try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}
            emit Settled(0, losersCount, 0, totalPool, block.timestamp);
            return;
        }

        // All win
        if (losersCount == 0) {
            uint256 allWinBonus = _prizePool / winnersCount;
            uint256 allWinDistributed;
            for (uint256 i = 0; i < pLen; i++) {
                address p = _participants[i];
                uint256 payout = _stakes[p] + allWinBonus;
                pendingWithdrawals[p] += payout;
                allWinDistributed     += payout;
                emit ParticipantSettled(p, true, payout, int256(allWinBonus));
                repUsers[repCount] = p; repDeltas[repCount] = 100; repCount++;
            }
            assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
            try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}
            uint256 allWinDust = _prizePool - allWinBonus * winnersCount;
            if (allWinDust > 0) {
                try ITreasury(treasuryAddress).depositFee{value: allWinDust}() {} catch {}
            }
            emit Settled(winnersCount, 0, allWinDistributed, allWinDust, block.timestamp);
            return;
        }

        // Mixed
        uint256 prizeBonus = _prizePool / winnersCount;
        uint256 totalDistributed;
        for (uint256 i = 0; i < pLen; i++) {
            address p = _participants[i];
            if (_verdicts[p]) {
                uint256 groupWinnings = (_stakes[p] * loserPot) / totalWinnerStake;
                uint256 payout        = _stakes[p] + groupWinnings + prizeBonus;
                pendingWithdrawals[p] += payout;
                totalDistributed      += payout;
                emit ParticipantSettled(p, true, payout, int256(groupWinnings + prizeBonus));
                repUsers[repCount] = p; repDeltas[repCount] = 100; repCount++;
            } else {
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
                repUsers[repCount] = p; repDeltas[repCount] = -50; repCount++;
            }
        }

        assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
        try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}

        uint256 dust = (totalWinnerStake + loserPot + _prizePool) - totalDistributed;
        if (dust > 0) {
            try ITreasury(treasuryAddress).depositFee{value: dust}() {} catch {}
        }

        emit Settled(winnersCount, losersCount, totalDistributed, dust, block.timestamp);
    }

    function returnPrizePoolToTreasury() external {
        require(msg.sender == _creator, "Only creator");
        require(
            _state == ChallengeState.Active ||
            (_state == ChallengeState.JoinOpen && block.timestamp > _joinDeadline),
            "Not in recoverable state"
        );
        require(_participants.length == 0,            "Participants exist");
        require(block.timestamp > _challengeDeadline, "Challenge not over");

        _state = ChallengeState.Settled;
        uint256 amount = _prizePool;
        _prizePool = 0;
        ITreasury(treasuryAddress).depositFee{value: amount}();
    }

    function prizePool() external view returns (uint256) { return _prizePool; }
}
