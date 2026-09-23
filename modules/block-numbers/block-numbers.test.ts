import { expect, test, describe, vi, beforeEach } from 'vitest';
import { blockNumbers } from './index';
import { Chain } from '@prisma/client';

describe('blockNumbers', () => {
    const repo = {
        getLatestEvent: vi.fn(),
        getDailyBlockNumbers: vi.fn(),
    };

    beforeEach(() => {
        repo.getLatestEvent.mockReset();
        repo.getDailyBlockNumbers.mockReset();
    });

    describe('getBlock', () => {
        test('should return block number for given timestamp', async () => {
            repo.getLatestEvent.mockResolvedValue({ blockNumber: 12345, blockTimestamp: 1000 });

            const service = blockNumbers(repo as any);
            const result = await service.getBlock(Chain.SONIC, 1000);

            expect(repo.getLatestEvent).toHaveBeenCalledWith({ chain: Chain.SONIC, timestamp: 1000 });
            expect(result).toBe(12345);
        });

        test('should return undefined if no event found', async () => {
            repo.getLatestEvent.mockResolvedValue(undefined);

            const service = blockNumbers(repo as any);
            const result = await service.getBlock(Chain.SONIC, 1000);

            expect(result).toBeUndefined();
        });
    });

    describe('getTimestamp', () => {
        test('should return timestamp for given block', async () => {
            repo.getLatestEvent.mockResolvedValue({ blockNumber: 12345, blockTimestamp: 1000 });

            const service = blockNumbers(repo as any);
            const result = await service.getTimestamp(Chain.SONIC, 12345);

            expect(repo.getLatestEvent).toHaveBeenCalledWith({ chain: Chain.SONIC, block: 12345 });
            expect(result).toBe(1000);
        });
    });

    describe('getDailyBlocks', () => {
        test('should return daily block numbers', async () => {
            const mockBlocks = [
                { timestamp: 1000, number: 12345 },
                { timestamp: 2000, number: 12445 },
            ];
            repo.getDailyBlockNumbers.mockResolvedValue(mockBlocks);

            const service = blockNumbers(repo as any);
            const result = await service.getDailyBlocks(Chain.SONIC, 2);

            expect(repo.getDailyBlockNumbers).toHaveBeenCalledWith(Chain.SONIC, 2);
            expect(result).toEqual(mockBlocks);
        });
    });
});
