// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Types.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/ITreasury.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFactory {
    function createChallenge(
        ChallengeType challengeType,
        VerifierType  verifier,
        string calldata title,
        string calldata criteria,
        uint256 joinDeadline,
        uint256 challengeDeadline,
        uint256 buyIn
    ) external payable returns (address);
}

contract PublicGovernance is Ownable {
    uint256 private constant UPKEEP_FUNDING = 2e18;

    struct Proposal {
        string       title;
        string       description;
        VerifierType verifier;
        uint256      durationDays;    // becomes challengeDeadline - joinDeadline
        uint256      joinDays;        // how long JOIN_OPEN lasts
        uint256      minStake;        // buyIn for the resulting PublicChallenge
        uint256      votes;
        uint256      voters;
    }

    Proposal[] _proposals;
    uint256    _currentEpoch;
    uint256    _epochEnd;
    uint256    _epochDuration;
    uint256    public prizePerEpoch;   // ETH pulled from Treasury for each winning challenge

    // Tracks who voted this epoch so we can clear their flags in tickEpoch
    address[]              _votersThisEpoch;
    mapping(address => bool) _hasVotedThisEpoch;

    address reputationAddress;
    address treasuryAddress;
    address factoryAddress;
    address linkToken;

    event ProposalCreated(
        uint256 indexed proposalIndex,
        string  title,
        string  description,
        VerifierType verifier,
        uint256 durationDays,
        uint256 minStake,
        uint256 epoch
    );

    event Voted(
        address indexed voter,
        uint256 proposalIndex,
        uint256 weight,
        uint256 newVoteCount
    );

    event EpochTicked(
        uint256 epoch,
        uint256 winningProposalIndex,
        string  winningTitle,
        address publicChallengeAddress,
        uint256 prizePool
    );

    constructor(
        address _reputationAddress,
        address _treasuryAddress,
        address _factoryAddress,
        address _linkToken,
        uint256 epochDuration,
        address initialOwner
    ) Ownable(initialOwner) {
        reputationAddress = _reputationAddress;
        treasuryAddress   = _treasuryAddress;
        factoryAddress    = _factoryAddress;
        linkToken         = _linkToken;
        _epochDuration    = epochDuration;
        _currentEpoch     = 1;
        _epochEnd         = block.timestamp + epochDuration;
    }

    // Required so Treasury can push ETH here during withdrawPrizePool in tickEpoch.
    receive() external payable {}

    function setPrizePerEpoch(uint256 amount) external onlyOwner {
        prizePerEpoch = amount;
    }

    // Only the protocol owner creates proposals; community votes on them.
    function propose(
        string calldata title,
        string calldata description,
        VerifierType    verifier,
        uint256         durationDays,
        uint256         joinDays,
        uint256         minStake
    ) external onlyOwner {
        require(bytes(title).length > 0,       "Title required");
        require(bytes(description).length > 0, "Description required");
        require(durationDays > 0,              "Duration must be > 0");
        require(joinDays > 0,                  "Invalid join days");
        require(minStake > 0,                  "Min stake must be > 0");

        _proposals.push(Proposal({
            title:        title,
            description:  description,
            verifier:     verifier,
            durationDays: durationDays,
            joinDays:     joinDays,
            minStake:     minStake,
            votes:        0,
            voters:       0
        }));

        emit ProposalCreated(_proposals.length - 1, title, description, verifier, durationDays, minStake, _currentEpoch);
    }

    function vote(uint256 proposalIndex) external {
        require(block.timestamp < _epochEnd,              "Epoch has ended");
        require(proposalIndex < _proposals.length,        "Invalid proposal index");
        require(!_hasVotedThisEpoch[msg.sender],          "Already voted this epoch");

        int256 rawScore = IReputation(reputationAddress).getScore(msg.sender);
        require(rawScore > 0, "No voting power");
        uint256 weight = uint256(rawScore);

        _proposals[proposalIndex].votes  += weight;
        _proposals[proposalIndex].voters += 1;
        _hasVotedThisEpoch[msg.sender] = true;
        _votersThisEpoch.push(msg.sender);

        emit Voted(msg.sender, proposalIndex, weight, _proposals[proposalIndex].votes);
    }

    // Callable by anyone once epochEnd has passed.
    function tickEpoch() external {
        require(block.timestamp >= _epochEnd,  "Epoch not ended yet");
        require(_proposals.length > 0,         "No proposals this epoch");
        require(prizePerEpoch > 0,             "Prize pool per epoch not set");

        // Find winning proposal (most votes; first proposal wins ties)
        uint256 winningVotes;
        uint256 winningIndex;
        for (uint256 i = 0; i < _proposals.length; i++) {
            if (_proposals[i].votes > winningVotes) {
                winningVotes = _proposals[i].votes;
                winningIndex = i;
            }
        }

        Proposal memory winner = _proposals[winningIndex];

        // Pull prize pool ETH from Treasury and approve factory to spend LINK from this contract
        ITreasury(treasuryAddress).withdrawPrizePool(address(this), prizePerEpoch);
        IERC20(linkToken).approve(factoryAddress, UPKEEP_FUNDING);

        uint256 joinDeadline      = block.timestamp + winner.joinDays * 1 days;
        uint256 challengeDeadline = joinDeadline + winner.durationDays * 1 days;

        address publicChallengeAddress = IFactory(factoryAddress).createChallenge{value: prizePerEpoch}(
            ChallengeType.Public,
            winner.verifier,
            winner.title,
            winner.description,
            joinDeadline,
            challengeDeadline,
            winner.minStake
        );

        emit EpochTicked(_currentEpoch, winningIndex, winner.title, publicChallengeAddress, prizePerEpoch);

        // Reset proposals and advance epoch
        delete _proposals;
        _currentEpoch += 1;
        _epochEnd = block.timestamp + _epochDuration;

        // Clear per-epoch voter flags using the tracked voter list
        for (uint256 i = 0; i < _votersThisEpoch.length; i++) {
            delete _hasVotedThisEpoch[_votersThisEpoch[i]];
        }
        delete _votersThisEpoch;
    }

    function getProposals() external view returns (Proposal[] memory) {
        return _proposals;
    }

    function hasVotedThisEpoch(address user) external view returns (bool) {
        return _hasVotedThisEpoch[user];
    }

    function getVoteWeight(address user) external view returns (uint256) {
        int256 score = IReputation(reputationAddress).getScore(user);
        return score > 0 ? uint256(score) : 0;
    }

    function currentEpochEnd() external view returns (uint256) {
        return _epochEnd;
    }

    function currentEpoch() external view returns (uint256) {
        return _currentEpoch;
    }
}
