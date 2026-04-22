import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export const getDatabaseUrlsFromEnvString = (envString: string): string[] => {
    return envString.split(",").map(url => url.trim());
}

const resolveDatabaseUrl = (url?: string): string | undefined => {
    return url ?? process.env.PRISMA_DATABASE_URL ?? process.env.DATABASE_URL;
}

const buildPrismaClientOptions = (url?: string) => {
    const dbUrl = resolveDatabaseUrl(url);
    if (!dbUrl) {
        throw new Error("Missing database URL. Set PRISMA_DATABASE_URL or DATABASE_URL.");
    }

    return {
        adapter: new PrismaPg({ connectionString: dbUrl }),
    };
}

const PrismaFactory = () => {
    const newClient = new PrismaClient(buildPrismaClientOptions());

    return newClient as any;
}

export {PrismaFactory}

export type ExtendedPrismaClientType = ReturnType<typeof PrismaFactory>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    constructor(@Optional() url?: string) {
        super(buildPrismaClientOptions(url));
    }

    async onModuleInit() : Promise<void> {
        console.warn("PrismaService initialized, should not be unless seeding or migrating");
        await this.$connect();
    }
}