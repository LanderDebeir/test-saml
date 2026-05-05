import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserDAO } from './types/daos';
import { hashPassword } from 'src/utils';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getById({ id, password }: { id: number; password: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      if (user && user.password !== hashPassword(password)) {
        throw new Error('Invalid credentials');
      }
      return user;
    } catch {
      return null;
    }
  }

  async getByEmail({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<null | UserDAO> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (user && user.password !== hashPassword(password)) {
        throw new Error('Invalid credentials');
      }
      return user;
    } catch {
      return null;
    }
  }

  async createUser({
    email,
    password,
    displayName,
    imageUrl,
  }: {
    email: string;
    password: string;
    displayName: string;
    imageUrl: string;
  }) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashPassword(password),
          displayName,
          imageUrl,
          createdAt: new Date(),
        },
      });
      this.logger.log(`User created: id=${user.id}, email="${user.email}"`);
      return user;
    } catch (error) {
      this.logger.error('Error creating user', error);
      throw new Error('Failed to create user');
    }
  }

  async deleteUser({ id }: { id: number }) {
    try {
      this.logger.log(`User deleted: id=${id}`);
      return this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error deleting user', error);
      throw new Error('Failed to delete user');
    }
  }

  async updateUser({
    id,
    email,
    password,
  }: {
    id: number;
    email?: string;
    password?: string;
  }) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) throw new Error('User not found');

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          email: email ? email : user.email,
          password: password ? hashPassword(password) : user.password,
        },
      });
      this.logger.log(`User updated: id=${updatedUser.id}, email="${updatedUser.email}"`);
      return updatedUser;
    } catch (error) {
      this.logger.error('Error updating user', error);
      throw new Error('Failed to update user');
    }
  }
}
