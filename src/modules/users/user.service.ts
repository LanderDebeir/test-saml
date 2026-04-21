import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserDAO } from "./types/daos";

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

    async getByEmail({email}: {email: string}) : Promise<null | UserDAO> {
        try{
            return this.prisma.user.findUnique({
                where: {email}
            });
        } catch {
            return null;
        }
    }
}