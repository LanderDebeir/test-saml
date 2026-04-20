import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { PrismaClient } from "@prisma/client/extension";

export const getDatabaseUrlsFromEnvString = (envString: string): string[] => {
    return envString.split(",").map(url => url.trim());
}

const PrismaFactory = () => {
    const newClient = new PrismaClient({
        dataSourceUrl: process.env.PRISMA_DATABASE_URL,
    });

    return newClient as any;
}

export {PrismaFactory}

export type ExtendedPrismaClientType = ReturnType<typeof PrismaFactory>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    constructor(@Optional() url?: string) {
        super({
            dataSources: {
                db: {url: url ? url : process.env.PRISMA_DATABASE_URL}
            }
        });
    }

    async onModuleInit() : Promise<void> {
        console.warn("PrismaService initialized, should not be unless seeding or migrating");
        await this.$connect();
    }
}