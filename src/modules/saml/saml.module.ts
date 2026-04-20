import { Module } from "@nestjs/common";
import { SamlService } from "./saml.service";

@Module({
    imports: [],
    providers: [SamlService],
    exports: [SamlService]
})
export class SamlModule {}