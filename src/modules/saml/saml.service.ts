import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { UserService } from "../users/user.service";
import { Strategy  as SamlStrategy,} from "passport-saml";
import { passport } from "passport"
import {readFileSync } from "fs";

@Injectable()
export class SamlService {
    private readonly logger = new Logger(SamlService.name);
    constructor(
        @Inject (forwardRef(() => UserService))
        private readonly userService: UserService
    ) {}

    async authenticate(){
        passport.use(new SamlStrategy(
            {
                path: "/login/callback",
                entryPoint: "",
                issuer: "passport-saml",
                cert: readFileSync("../../config/certificates/saml-certificate.cer", "utf-8"),
            },
            async (_req, profile, done) => {
                try {
                    const user = await this.userService.getByEmail({ email: profile?.email || "", password:  `${profile?.password}` || "" });
                    return done(null, { user });
                } catch (error) {
                    return done(error as Error);
                }
            }
        ))
    }

    private async findOrCreateUser({email, password}: {email: string, password: string}) {
        let user = await this.userService.getByEmail({email, password});

        if (!user) {
            user = await this.userService.createUser({email, password});
        }
        return {email: user?.email};
    }
}