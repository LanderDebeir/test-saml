import { hash } from 'crypto';

export const users: { email: string; password: string; createdAt: Date }[] = [
  {
    email: 'lander.debeir@jimber.io',
    password: hash('sha256', 'password123'),
    createdAt: new Date(),
  },
];
