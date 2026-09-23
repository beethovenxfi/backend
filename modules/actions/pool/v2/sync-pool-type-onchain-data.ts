import { Chain } from '@prisma/client';
import { prisma } from '../../../../prisma/prisma-client';
import { prismaBulkExecuteOperations } from '../../../../prisma/prisma-util';

const update = async (data: { id: string; chain: Chain; typeData: any }[]) => {
    // Update the pool type data
    const updates = data.map(({ id, chain, typeData }) =>
        prisma.prismaPool.update({
            where: { id_chain: { id, chain } },
            data: { typeData },
        }),
    );

    await prismaBulkExecuteOperations(updates, false);
};
