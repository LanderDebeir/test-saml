import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserDAO } from "./types/daos";
import { hash } from "crypto";

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    constructor(
        private readonly prisma: PrismaService
    ) {}

    async getById({id, password}: {id: number, password: string}) {
        try{
            const user = await this.prisma.user.findUnique({
                where: {id}
            });
            if (user && user.password !== hash("sha256", password)) {
                throw new Error("Invalid credentials");
            }
            return user;
        } catch {
            return null;
        }
    }

    async getByEmail({email, password}: {email: string, password: string}) : Promise<null | UserDAO> {
        try{
            const user = await this.prisma.user.findUnique({
                where: {email}
            });
            if (user && user.password !== hash("sha256", password)) {
                throw new Error("Invalid credentials");
            }
            return user;
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
                    password: hash("sha256", password)
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