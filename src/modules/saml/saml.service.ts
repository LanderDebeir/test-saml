import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { UserService } from "../users/user.service";
import { Strategy  as SamlStrategy,} from "passport-saml";
import passport from "passport"
import {readFileSync } from "fs";
import { hash } from "crypto";

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
                    const user = await this.userService.getByEmail({ email: profile?.email || "" });
                    return done(null, { user });
                } catch (error) {
                    return done(error as Error);
                }
            }
        ))
    }

    private async findOrCreateUser({email, password}: {email: string, password: string}) {
        let user = await this.userService.getByEmail({email});
        if(user && user.password !== hash("sha256", password)) {
            throw new Error("Invalid credentials");
        }
        if (!user) {
            user = await this.userService.createUser({email, name: email.split("@")[0], password: hash("sha256", password)});
        }
        return {email: user?.email, name: user?.name};
    }
}