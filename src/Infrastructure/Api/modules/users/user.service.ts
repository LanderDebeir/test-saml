import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    constructor(
        private readonly prisma: PrismaService
    ) {}

    async getById({id}: {id: number}) {
        try{
            return this.prisma.user.findUnique({
                where: {id}
            });
        } catch {
            return null;
        }
    }

    async getByEmail({email}: {email: string}) {
        try{
            return this.prisma.user.findUnique({
                where: {email}
            });
        } catch {
            return null;
        }
    }
}