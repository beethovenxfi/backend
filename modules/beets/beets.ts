import beetsAbi from '../sources/contracts/abis/ERC20';
import config from '../../config';
import { Chain } from '@prisma/client';
import { getViemClient } from '../sources/viem-client';
import { formatEther, parseEther } from 'viem';

const BURNED = '0x000000000000000000000000000000000000dEaD';

const NON_CIRCULATING_ADDRESSES_SONIC = [
    '0xc5E0250037195850E4D987CA25d6ABa68ef5fEe8', //treasury
    '0x8a81173FC726eEDd1ad6036dB6197027C77865C2', //beets minting target
    '0x5f9a5CD0B77155AC1814EF6Cd9D82dA53d05E386', //beets migration contract
    BURNED, //burn address
];

export async function beetsGetCirculatingSupply(chain: Chain) {
    const viemClient = getViemClient(chain);

    let totalSupply = parseEther(await beetsGetTotalSupply(chain));

    for (const address of NON_CIRCULATING_ADDRESSES_SONIC) {
        const balance = await viemClient.readContract({
            address: config[chain].beets!.address as `0x${string}`,
            abi: beetsAbi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
        });
        totalSupply = totalSupply - balance;
    }

    return formatEther(totalSupply);
}

export async function beetsGetTotalSupply(chain: Chain) {
    const viemClient = getViemClient(chain);
    const address = config[chain].beets!.address as `0x${string}`;

    const burnedBalance = await viemClient.readContract({
        address: config[chain].beets!.address as `0x${string}`,
        abi: beetsAbi,
        functionName: 'balanceOf',
        args: [BURNED as `0x${string}`],
    });

    let totalSupply = await viemClient.readContract({
        address: address,
        abi: beetsAbi,
        functionName: 'totalSupply',
    });

    return formatEther(totalSupply - burnedBalance);
}
