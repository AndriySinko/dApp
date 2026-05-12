// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Types.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/ITreasury.sol";
import "../interfaces/IChallenge.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IChallengeDeployer {
    function factory() external view returns (address);
    function deploy(
        uint256 id,
        address creatorAddr,
        string calldata titleStr,
        string calldata criteriaStr,
        uint256 joinDl,
        uint256 challengeDl,
        uint256 buyInAmt,
        VerifierType vType,
        address vAddress,
        address repAddress,
        address treasAddress
    ) external payable returns (address);
}

interface IAutomationRegistrar {
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
    function registerUpkeep(RegistrationParams calldata requestParams) external returns (uint256 id);
}

contract ChallengeFactory {
    using SafeERC20 for IERC20;

    uint256 public constant UPKEEP_FUNDING = 2e18;

    address[] allChallenges;
    mapping(address => address[]) userChallenges;
    mapping(address => ChallengeInfo) challengeInfos;

    struct ChallengeInfo {
        uint256       id;
        ChallengeType challengeType;
        VerifierType  verifier;
        address       creator;
        string        title;
    }

    address reputationAddress;
    address treasuryAddress;
    address onChainVerifier;
    address apiVerifier;
    address aiVerifier;
    address automationRegistry;
    address linkToken;
    address individualDeployer;
    address groupDeployer;
    address publicDeployer;

    uint256 nextId;

    event ChallengeCreated(
        uint256 indexed challengeId,
        address indexed contractAddress,
        address indexed creator,
        ChallengeType   challengeType,
        VerifierType    verifier,
        string  title,
        string  criteria,
        uint256 buyIn,
        uint256 joinDeadline,
        uint256 challengeDeadline
    );

    event UserActivity(
        address indexed user,
        address indexed challengeAddress,
        ActivityType    activityType,
        uint256         amount
    );

    constructor(
        address _reputationAddress,
        address _treasuryAddress,
        address _onChainVerifier,
        address _apiVerifier,
        address _aiVerifier,
        address _automationRegistry,
        address _linkToken,
        address _individualDeployer,
        address _groupDeployer,
        address _publicDeployer
    ) {
        require(_reputationAddress  != address(0), "Zero reputation");
        require(_treasuryAddress    != address(0), "Zero treasury");
        require(_onChainVerifier    != address(0), "Zero onchain verifier");
        require(_apiVerifier        != address(0), "Zero api verifier");
        require(_aiVerifier         != address(0), "Zero ai verifier");
        require(_automationRegistry != address(0), "Zero automation registry");
        require(_linkToken          != address(0), "Zero link token");
        require(_individualDeployer != address(0), "Zero individual deployer");
        require(_groupDeployer      != address(0), "Zero group deployer");
        require(_publicDeployer     != address(0), "Zero public deployer");

        reputationAddress  = _reputationAddress;
        treasuryAddress    = _treasuryAddress;
        onChainVerifier    = _onChainVerifier;
        apiVerifier        = _apiVerifier;
        aiVerifier         = _aiVerifier;
        automationRegistry = _automationRegistry;
        linkToken          = _linkToken;
        individualDeployer = _individualDeployer;
        groupDeployer      = _groupDeployer;
        publicDeployer     = _publicDeployer;
    }

    function createChallenge(
        ChallengeType challengeType,
        VerifierType  verifier,
        string calldata title,
        string calldata criteria,
        uint256 joinDeadline,
        uint256 challengeDeadline,
        uint256 buyIn
    ) external payable returns (address challengeAddress) {
        require(challengeDeadline > block.timestamp, "Challenge deadline must be in the future");
        require(joinDeadline > block.timestamp,      "Join deadline must be in the future");
        require(joinDeadline < challengeDeadline,    "Join deadline must be before challenge deadline");
        if (challengeType == ChallengeType.Individual) {
            require(msg.value == buyIn, "Creator must stake buy-in for Individual challenge");
        } else if (challengeType == ChallengeType.Group) {
            require(msg.value == 0, "No initial stake for Group challenges");
        } else {
            require(msg.value > 0, "Must send prize pool ETH for Public challenge");
        }

        IERC20(linkToken).safeTransferFrom(msg.sender, address(this), UPKEEP_FUNDING);
        IERC20(linkToken).forceApprove(automationRegistry, UPKEEP_FUNDING);

        uint256 id = nextId++;
        address resolvedVerifier = _resolveVerifier(verifier);

        address deployer;
        if (challengeType == ChallengeType.Individual) {
            deployer = individualDeployer;
            require(IChallengeDeployer(deployer).factory() == address(this), "Deployer not initialized");
            challengeAddress = IChallengeDeployer(deployer).deploy{value: msg.value}(
                id, msg.sender, title, criteria,
                joinDeadline, challengeDeadline, buyIn,
                verifier, resolvedVerifier,
                reputationAddress, treasuryAddress
            );
        } else if (challengeType == ChallengeType.Group) {
            deployer = groupDeployer;
            require(IChallengeDeployer(deployer).factory() == address(this), "Deployer not initialized");
            challengeAddress = IChallengeDeployer(deployer).deploy(
                id, msg.sender, title, criteria,
                joinDeadline, challengeDeadline, buyIn,
                verifier, resolvedVerifier,
                reputationAddress, treasuryAddress
            );
        } else {
            deployer = publicDeployer;
            require(IChallengeDeployer(deployer).factory() == address(this), "Deployer not initialized");
            challengeAddress = IChallengeDeployer(deployer).deploy{value: msg.value}(
                id, msg.sender, title, criteria,
                joinDeadline, challengeDeadline, buyIn,
                verifier, resolvedVerifier,
                reputationAddress, treasuryAddress
            );
        }

        IReputation(reputationAddress).authorizeChallenge(challengeAddress);
        ITreasury(treasuryAddress).authorizeChallenge(challengeAddress);

        // Register Chainlink Automation upkeep — non-reverting so challenge creation
        // always succeeds even if the registrar rejects (owner can register manually).
        try IAutomationRegistrar(automationRegistry).registerUpkeep(
            IAutomationRegistrar.RegistrationParams({
                name:           title,
                encryptedEmail: bytes(""),
                upkeepContract: challengeAddress,
                gasLimit:       3_000_000,
                adminAddress:   msg.sender,
                triggerType:    0,
                checkData:      bytes(""),
                triggerConfig:  bytes(""),
                offchainConfig: bytes(""),
                amount:         uint96(UPKEEP_FUNDING)
            })
        ) returns (uint256 upkeepId) {
            if (upkeepId != 0) {
                IChallenge(challengeAddress).setUpkeepRegistered();
            }
        } catch {
            // Upkeep registration failed — challenge created but Automation not active.
            // Register manually at automation.chain.link if needed.
        }

        allChallenges.push(challengeAddress);
        challengeInfos[challengeAddress] = ChallengeInfo({
            id:            id,
            challengeType: challengeType,
            verifier:      verifier,
            creator:       msg.sender,
            title:         title
        });
        _registerUserActivity(msg.sender, challengeAddress);

        emit ChallengeCreated(
            id, challengeAddress, msg.sender,
            challengeType, verifier,
            title, criteria, buyIn,
            joinDeadline, challengeDeadline
        );
    }

    function getAllChallenges() external view returns (address[] memory) {
        return allChallenges;
    }

    function getUserChallenges(address user) external view returns (address[] memory) {
        return userChallenges[user];
    }

    function getChallengeInfo(address challenge) external view returns (
        uint256 id, ChallengeType challengeType, VerifierType verifier,
        address creator, string memory title
    ) {
        ChallengeInfo memory info = challengeInfos[challenge];
        return (info.id, info.challengeType, info.verifier, info.creator, info.title);
    }

    function _resolveVerifier(VerifierType vType) internal view returns (address) {
        if (vType == VerifierType.OnChain)   return onChainVerifier;
        if (vType == VerifierType.ApiOracle) return apiVerifier;
        return aiVerifier;
    }

    function _registerUserActivity(address user, address challenge) internal {
        if (userChallenges[user].length == 0 || userChallenges[user][userChallenges[user].length - 1] != challenge) {
            userChallenges[user].push(challenge);
        }
    }
}
