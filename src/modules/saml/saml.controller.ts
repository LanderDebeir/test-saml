import { Controller, Post } from "@nestjs/common";
import { SamlService } from "./saml.service";

@Controller({path: "auth", version: "1"})
export class SamlController {
    constructor(
        private readonly samlService: SamlService
    ) {}

    // @Post()
    // authenticate() {
    //     return this.samlService.authenticate();
    // }
}