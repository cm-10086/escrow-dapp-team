// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "./Escrow.sol";

/// @notice Combined shipping and two-of-two arbitration bonus contract.
contract EscrowBonus {
    // Keep the original five numeric values stable; Shipped is appended.
    enum Status {
        Created,
        Paid,
        Completed,
        Refunded,
        Disputed,
        Shipped
    }

    struct Order {
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 deadline;
        Status status;
        string description;
    }

    address public immutable arbiter;
    address public immutable arbiter2;
    uint256 public orderCount;
    mapping(uint256 => Order) private _orders;
    // 0 = not voted, 1 = refund buyer, 2 = pay seller. A false vote must not look like no vote.
    mapping(uint256 => mapping(address => uint8)) public resolutionVotes;
    mapping(uint256 => uint256) public lastResolutionVoteBlock;

    event OrderCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    event OrderPaid(uint256 indexed id);
    event OrderShipped(uint256 indexed id, address indexed seller);
    event OrderCompleted(uint256 indexed id);
    event OrderRefunded(uint256 indexed id);
    event OrderDisputed(uint256 indexed id, address by);
    event OrderResolved(uint256 indexed id, bool sellerWins);
    event ResolutionVoted(uint256 indexed id, address indexed arbiter, bool sellerWins);

    modifier onlyBuyer(uint256 id) {
        require(msg.sender == _orders[id].buyer, "Escrow: caller is not the buyer");
        _;
    }

    modifier onlySeller(uint256 id) {
        require(msg.sender == _orders[id].seller, "Escrow: caller is not the seller");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter || msg.sender == arbiter2, "Escrow: caller is not an arbiter");
        _;
    }

    modifier inStatus(uint256 id, Status expected) {
        require(_orders[id].status == expected, "Escrow: wrong status");
        _;
    }

    constructor(address _arbiter, address _arbiter2) {
        require(_arbiter != address(0) && _arbiter2 != address(0), "Escrow: arbiter is the zero address");
        require(_arbiter != _arbiter2, "Escrow: arbiters must be distinct");
        arbiter = _arbiter;
        arbiter2 = _arbiter2;
    }

    function supportsShipping() external pure returns (bool) {
        return true;
    }

    function supportsDualArbitration() external pure returns (bool) {
        return true;
    }

    function getOrder(uint256 id) public view returns (Order memory) {
        require(id < orderCount, "Escrow: order does not exist");
        return _orders[id];
    }

    function createOrder(
        address seller,
        address token,
        uint256 amount,
        uint256 deadline,
        string memory description
    ) public returns (uint256) {
        require(seller != address(0), "Escrow: seller is the zero address");
        require(seller != msg.sender, "Escrow: buyer cannot be seller");
        require(token != address(0), "Escrow: token is the zero address");
        require(amount > 0, "Escrow: amount is zero");
        require(deadline > block.timestamp, "Escrow: deadline must be in the future");
        uint256 id = orderCount++;
        _orders[id] = Order(msg.sender, seller, token, amount, deadline, Status.Created, description);
        emit OrderCreated(id, msg.sender, seller, token, amount, deadline);
        return id;
    }

    function deposit(uint256 id) public onlyBuyer(id) inStatus(id, Status.Created) {
        Order storage order = _orders[id];
        require(block.timestamp <= order.deadline, "Escrow: payment deadline passed");
        order.status = Status.Paid;
        require(
            IERC20(order.token).transferFrom(msg.sender, address(this), order.amount),
            "Escrow: transferFrom failed"
        );
        emit OrderPaid(id);
    }

    function markShipped(uint256 id) public onlySeller(id) inStatus(id, Status.Paid) {
        Order storage order = _orders[id];
        // After expiry the buyer can refund; the seller cannot revoke that right by marking late shipping.
        require(block.timestamp <= order.deadline, "Escrow: shipping deadline passed");
        order.status = Status.Shipped;
        emit OrderShipped(id, msg.sender);
    }

    function confirm(uint256 id) public onlyBuyer(id) {
        Order storage order = _orders[id];
        require(order.status == Status.Paid || order.status == Status.Shipped, "Escrow: order is not paid or shipped");
        order.status = Status.Completed;
        require(IERC20(order.token).transfer(order.seller, order.amount), "Escrow: transfer failed");
        emit OrderCompleted(id);
    }

    function refund(uint256 id) public onlyBuyer(id) inStatus(id, Status.Paid) {
        Order storage order = _orders[id];
        require(block.timestamp > order.deadline, "Escrow: deadline not passed");
        order.status = Status.Refunded;
        require(IERC20(order.token).transfer(order.buyer, order.amount), "Escrow: transfer failed");
        emit OrderRefunded(id);
    }

    function dispute(uint256 id) public {
        Order storage order = _orders[id];
        require(order.status == Status.Paid || order.status == Status.Shipped, "Escrow: order is not paid or shipped");
        require(msg.sender == order.buyer || msg.sender == order.seller, "Escrow: caller is not a party");
        order.status = Status.Disputed;
        emit OrderDisputed(id, msg.sender);
    }

    function resolve(uint256 id, bool sellerWins) public onlyArbiter inStatus(id, Status.Disputed) {
        uint8 decision = sellerWins ? 2 : 1;
        require(resolutionVotes[id][msg.sender] != decision, "Escrow: same vote already submitted");
        // A changed opinion is allowed while disputed; repeating one's vote never counts as a second signer.
        resolutionVotes[id][msg.sender] = decision;
        lastResolutionVoteBlock[id] = block.number;
        emit ResolutionVoted(id, msg.sender, sellerWins);
        if (resolutionVotes[id][arbiter] != decision || resolutionVotes[id][arbiter2] != decision) return;

        Order storage order = _orders[id];
        order.status = sellerWins ? Status.Completed : Status.Refunded;
        require(
            IERC20(order.token).transfer(sellerWins ? order.seller : order.buyer, order.amount),
            "Escrow: transfer failed"
        );
        emit OrderResolved(id, sellerWins);
    }
}
