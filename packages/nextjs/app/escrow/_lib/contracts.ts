import deployedContracts from "~~/contracts/deployedContracts";

export const CHAIN_ID = 60600;
export const escrowContract = deployedContracts[CHAIN_ID].Escrow;
export const tokenContract = deployedContracts[CHAIN_ID].PCMToken;
export const explorerUrl = "https://scan-testnet.potos.hk";
