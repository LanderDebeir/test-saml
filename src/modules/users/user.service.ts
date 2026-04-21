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

    async createUser({email, name, password}: {email: string, name: string, password: string}) {
        try{
            return this.prisma.user.create({
                data: {
                    email,
                    name,
                    password
                }
            });
        } catch (error) {
            this.logger.error("Error creating user", error);
            throw new Error("Failed to create user");
        }
    }

    async deleteUser({id}: {id: number}) {
        try{
            return this.prisma.user.delete({
                where: {id}
            });
        } catch (error) {
            this.logger.error("Error deleting user", error);
            throw new Error("Failed to delete user");
        }
    }

    async updateUser({id, email, name, password}: {id: number, email?: string, name?: string, password?: string}) {
        try{
            return this.prisma.user.update({
                where: {id},
                data: {
                    email,
                    name,
                    password
                }
            });
        } catch (error) {
            this.logger.error("Error updating user", error);
            throw new Error("Failed to update user");
        }
    }
}