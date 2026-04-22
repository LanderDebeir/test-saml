import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { UserService } from "../users/user.service";
import {readFileSync } from "fs";
import { IdentityProvider } from "samlify";

@Injectable()
export class SamlService {
    private readonly logger = new Logger(SamlService.name);
    private readonly idp = IdentityProvider({
        metadata: readFileSync("config/certificates/metadata_idp.xml")
    });
    constructor(
        @Inject (forwardRef(() => UserService))
        private readonly userService: UserService
    ) {}

    async getMetadata() {
        return this.idp.getMetadata();
    }

    private async findOrCreateUser({email, password}: {email: string, password: string}) {
        let user = await this.userService.getByEmail({email, password});

        if (!user) {
            user = await this.userService.createUser({email, password});
        }
        return {email: user?.email};
    }
}