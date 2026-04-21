import { forwardRef, Module } from "@nestjs/common";
import { UserModule } from "../users/user.module";
import { SamlService } from "./saml.service";

@Module({
    imports: [forwardRef(() => UserModule)],
    providers: [SamlService],
    exports: [SamlService]
})
export class SamlModule {}