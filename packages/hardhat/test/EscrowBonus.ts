import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const AMOUNT = ethers.parseUnits("30", 18);
async function fixture() {
  const [owner, buyer, seller, arbiter, outsider] = await ethers.getSigners();
  const token = await ethers.deployContract("PCMToken");
  const escrow = await ethers.deployContract("EscrowBonus", [arbiter.address]);
  await token.mint(buyer.address, AMOUNT * 4n);
  const deadline = (await time.latest()) + 600;
  await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "发货测试");
  await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT * 4n);
  return { owner, buyer, seller, arbiter, outsider, token, escrow, deadline };
}
async function paidFixture() {
  const state = await fixture();
  await state.escrow.connect(state.buyer).deposit(0);
  return state;
}
async function shippedFixture() {
  const state = await paidFixture();
  await state.escrow.connect(state.seller).markShipped(0);
  return state;
}

describe("EscrowBonus seller shipping", () => {
  it("advertises shipping support and retains Created/Paid/Completed/Refunded/Disputed numeric values", async () => {
    const { escrow, buyer } = await loadFixture(fixture);
    expect(await escrow.supportsShipping()).to.equal(true);
    expect((await escrow.getOrder(0)).status).to.equal(0n);
    await escrow.connect(buyer).deposit(0);
    expect((await escrow.getOrder(0)).status).to.equal(1n);
  });
  it("only the actual seller can ship; marking shipment leaves tokens in escrow", async () => {
    const { escrow, token, seller, buyer, arbiter, outsider } = await loadFixture(paidFixture);
    for (const actor of [buyer, arbiter, outsider]) {
      await expect(escrow.connect(actor).markShipped(0)).to.be.revertedWith("Escrow: caller is not the seller");
    }
    await expect(escrow.connect(seller).markShipped(0)).to.emit(escrow, "OrderShipped").withArgs(0n, seller.address);
    expect((await escrow.getOrder(0)).status).to.equal(5n);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
    expect(await token.balanceOf(seller.address)).to.equal(0n);
  });
  it("created, completed, refunded and disputed orders cannot be marked shipped", async () => {
    const { escrow, buyer, seller, token, deadline } = await loadFixture(fixture);
    await expect(escrow.connect(seller).markShipped(0)).to.be.revertedWith("Escrow: wrong status");
    for (let id = 1; id <= 3; id++) {
      await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "状态测试");
    }
    for (let id = 0; id <= 3; id++) await escrow.connect(buyer).deposit(id);
    await escrow.connect(buyer).confirm(0);
    await escrow.connect(seller).dispute(1);
    await time.increaseTo(deadline + 1);
    await escrow.connect(buyer).refund(2);
    for (const id of [0, 1, 2])
      await expect(escrow.connect(seller).markShipped(id)).to.be.revertedWith("Escrow: wrong status");
  });
  it("shipment cannot be marked twice", async () => {
    const { escrow, seller } = await loadFixture(shippedFixture);
    await expect(escrow.connect(seller).markShipped(0)).to.be.revertedWith("Escrow: wrong status");
  });
  it("unshipped orders cannot refund before or exactly at the deadline, but can refund afterwards", async () => {
    const { escrow, buyer, token, deadline } = await loadFixture(paidFixture);
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: deadline not passed");
    await time.setNextBlockTimestamp(deadline);
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: deadline not passed");
    await time.setNextBlockTimestamp(deadline + 1);
    await expect(escrow.connect(buyer).refund(0)).to.emit(escrow, "OrderRefunded").withArgs(0n);
    expect((await escrow.getOrder(0)).status).to.equal(3n);
    expect(await token.balanceOf(buyer.address)).to.equal(AMOUNT * 4n);
  });
  it("already-shipped orders cannot timeout-refund even long after the deadline", async () => {
    const { escrow, buyer, token, deadline } = await loadFixture(shippedFixture);
    await time.increaseTo(deadline + 3600);
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: wrong status");
    expect((await escrow.getOrder(0)).status).to.equal(5n);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
  });
  it("a late seller cannot block an expired buyer's refund by marking shipment", async () => {
    const { escrow, seller, buyer, deadline } = await loadFixture(paidFixture);
    await time.increaseTo(deadline + 1);
    await expect(escrow.connect(seller).markShipped(0)).to.be.revertedWith("Escrow: shipping deadline passed");
    await escrow.connect(buyer).refund(0);
    expect((await escrow.getOrder(0)).status).to.equal(3n);
  });
  it("shipping at the deadline is allowed, and timeout refund is then blocked", async () => {
    const { escrow, seller, buyer, deadline } = await loadFixture(paidFixture);
    await time.setNextBlockTimestamp(deadline);
    await escrow.connect(seller).markShipped(0);
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: wrong status");
  });
  it("only the buyer can confirm shipped goods; funds transfer once", async () => {
    const { escrow, buyer, seller, arbiter, token } = await loadFixture(shippedFixture);
    for (const actor of [seller, arbiter])
      await expect(escrow.connect(actor).confirm(0)).to.be.revertedWith("Escrow: caller is not the buyer");
    await expect(escrow.connect(buyer).confirm(0)).to.emit(escrow, "OrderCompleted").withArgs(0n);
    expect((await escrow.getOrder(0)).status).to.equal(2n);
    expect(await token.balanceOf(seller.address)).to.equal(AMOUNT);
    await expect(escrow.connect(buyer).confirm(0)).to.be.revertedWith("Escrow: order is not paid or shipped");
  });
  for (const party of ["buyer", "seller"] as const) {
    for (const sellerWins of [false, true]) {
      it(`${party} can dispute shipped goods and arbiter resolve(${sellerWins}) settles correctly`, async () => {
        const state = await loadFixture(shippedFixture);
        const { escrow, arbiter, buyer, seller, outsider, token } = state;
        await expect(escrow.connect(outsider).dispute(0)).to.be.revertedWith("Escrow: caller is not a party");
        await escrow.connect(state[party]).dispute(0);
        expect((await escrow.getOrder(0)).status).to.equal(4n);
        await expect(escrow.connect(buyer).resolve(0, sellerWins)).to.be.revertedWith(
          "Escrow: caller is not the arbiter",
        );
        await expect(escrow.connect(arbiter).resolve(0, sellerWins))
          .to.emit(escrow, "OrderResolved")
          .withArgs(0n, sellerWins);
        expect((await escrow.getOrder(0)).status).to.equal(sellerWins ? 2n : 3n);
        expect(await token.balanceOf(sellerWins ? seller.address : buyer.address)).to.equal(
          sellerWins ? AMOUNT : AMOUNT * 4n,
        );
        expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
        await expect(escrow.connect(arbiter).resolve(0, sellerWins)).to.be.revertedWith("Escrow: wrong status");
      });
    }
  }
  it("payment cannot create a stranded paid order after the deadline", async () => {
    const { escrow, buyer, deadline } = await loadFixture(fixture);
    await time.increaseTo(deadline + 1);
    await expect(escrow.connect(buyer).deposit(0)).to.be.revertedWith("Escrow: payment deadline passed");
    expect((await escrow.getOrder(0)).status).to.equal(0n);
  });
  it("legacy unshipped confirmation and dispute paths remain usable", async () => {
    const { escrow, buyer } = await loadFixture(paidFixture);
    await escrow.connect(buyer).confirm(0);
    expect((await escrow.getOrder(0)).status).to.equal(2n);
  });
});
