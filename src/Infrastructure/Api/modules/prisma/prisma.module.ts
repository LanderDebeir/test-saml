import { Module } from "@nestjs/common";
import { PrismaFactory, PrismaService } from "./prisma.service";

@Module({
    providers: [
        {
            provide: PrismaService,
            useFactory: PrismaFactory,
        }
    ],
    exports: [PrismaService],
})
export class PrismaModule {}