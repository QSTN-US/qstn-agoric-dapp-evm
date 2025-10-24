#!/bin/bash

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <network>"
    echo "Network must be either 'fuji' or 'base' or 'eth'"
    exit 1
fi

network=$1

deploy_contract() {
    local contract_path=$1
    local gateway_contract=$2
    local agoric_lca=$3
    local chain_name=$4

    GATEWAY_CONTRACT="$gateway_contract" \
        AGORIC_SENDER="$agoric_lca" \
        CHAIN_NAME="$chain_name" \

        npx hardhat ignition deploy "$contract_path" --network "$network" --verify
}

delete_deployments_folder() {
    local folder=$1
    if [ -d "$folder" ]; then
        echo "Deleting existing deployment folder: $folder"
        rm -rf "$folder"
    else
        echo "No existing deployment folder to delete: $folder"
    fi
}

AGORIC_LCA=""

case $network in
fuji)
    CHAIN_NAME='Avalanche'
    GATEWAY='0xC249632c2D40b9001FE907806902f63038B737Ab'
    ;;
base)
    CHAIN_NAME='Base'
    GATEWAY='0xe432150cce91c13a887f7D836923d5597adD8E31'
    ;;
eth)
    CHAIN_NAME='Ethereum'
    GATEWAY='0x4F4495243837681061C4743b74B3eEdf548D56A5'
    ;;
*)
    echo "Invalid network specified"
    exit 1
    ;;
esac

delete_deployments_folder "ignition/deployments"

deploy_contract "./ignition/modules/deployQuizzlerV2.cjs" "$GATEWAY" "$AGORIC_LCA" "$CHAIN_NAME"