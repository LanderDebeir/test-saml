import { Controller, Get, Post, Req, Res, Body } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { UserService } from '../users/user.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly userService: UserService,
  ) {}

  private parseCookie(req: Request) {
    const header = req.headers.cookie || '';
    const pairs = header.split(';').map((p) => p.trim());
    const map: Record<string, string> = {};
    for (const p of pairs) {
      const [k, ...rest] = p.split('=');
      if (!k) continue;
      map[k] = decodeURIComponent(rest.join('='));
    }
    return map;
  }

  @Get('login')
  loginPage(@Res() res: Response) {
    return res.render('admin/login', {
      error: null,
      title: 'Admin Login',
      heading: 'Admin Login',
      formAction: '/admin/login',
      buttonLabel: 'Login',
      samlMode: false,
    });
  }

  @Post('login')
  async login(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const { email, password } = body;
    const user = await this.userService.getByEmail({ email, password });
    if (!user) {
      return res.render('admin/login', {
        error: 'Invalid credentials',
        title: 'Admin Login',
        heading: 'Admin Login',
        formAction: '/admin/login',
        buttonLabel: 'Login',
        samlMode: false,
      });
    }

    // Set a simple cookie to identify the logged user (no session store)
    res.cookie('admin_user', String(user.id), { httpOnly: true });
    return res.redirect('/admin');
  }

  @Get()
  async dashboard(@Req() req: Request, @Res() res: Response) {
    const cookies = this.parseCookie(req);
    if (!cookies.admin_user) return res.redirect('/admin/login');

    const services = await this.admin.listServices();
    const users = await this.userService['prisma'].user.findMany();
    const assignments = await this.admin.getAssignments();

    // Fetch user attributes for each user-service pair
    const userAttributesByServiceAndUser: Record<
      string,
      Record<string, string>
    > = {};
    for (const user of users) {
      const serviceIds = assignments[String(user.id)] || [];
      for (const serviceId of serviceIds) {
        const key = `${user.id}-${serviceId}`;
        userAttributesByServiceAndUser[key] =
          await this.admin.getUserAttributes(user.id, serviceId);
      }
    }

    return res.render('admin/index', {
      users,
      services,
      assignments,
      currentUserId: cookies.admin_user,
      userAttributesByServiceAndUser,
    });
  }

  @Post('users')
  async createUser(@Body() body: any, @Res() res: Response) {
    const { email, password, displayName } = body;
    await this.userService.createUser({
      email,
      password,
      displayName,
    });
    return res.redirect('/admin');
  }

  @Post('services')
  async createService(@Body() body: any, @Res() res: Response) {
    const { name, description } = body;
    await this.admin.addService({ name, description });
    return res.redirect('/admin');
  }

  @Post('service-attributes')
  async addServiceAttribute(@Body() body: any, @Res() res: Response) {
    const { serviceId, attributeName, attributeType } = body;
    await this.admin.addServiceAttribute({
      serviceId: Number(serviceId),
      attributeName,
      attributeType,
    });
    return res.redirect('/admin');
  }

  @Post('service-attributes/update')
  async updateServiceAttribute(@Body() body: any, @Res() res: Response) {
    const { serviceId, oldAttributeName, attributeName, attributeType } = body;
    await this.admin.updateServiceAttribute({
      serviceId: Number(serviceId),
      oldAttributeName,
      attributeName,
      attributeType,
    });
    return res.redirect('/admin');
  }

  @Post('service-attributes/remove')
  async removeServiceAttribute(@Body() body: any, @Res() res: Response) {
    const { serviceId, attributeName } = body;
    await this.admin.removeServiceAttribute({
      serviceId: Number(serviceId),
      attributeName,
    });
    return res.redirect('/admin');
  }

  @Post('user-attributes')
  async setUserAttribute(@Body() body: any, @Res() res: Response) {
    const { userId, serviceId, attributeName, attributeValue } = body;
    await this.admin.setUserAttribute({
      userId: Number(userId),
      serviceId: Number(serviceId),
      attributeName,
      attributeValue,
    });
    return res.redirect('/admin');
  }

  @Post('assign')
  async assign(@Body() body: any, @Res() res: Response) {
    const { userId, serviceId } = body;
    await this.admin.assignServiceToUser({
      userId: Number(userId),
      serviceId: Number(serviceId),
    });
    return res.redirect('/admin');
  }

  @Post('unassign')
  async unassign(@Body() body: any, @Res() res: Response) {
    const { userId, serviceId } = body;
    await this.admin.unassignServiceFromUser({
      userId: Number(userId),
      serviceId: Number(serviceId),
    });
    return res.redirect('/admin');
  }
}
