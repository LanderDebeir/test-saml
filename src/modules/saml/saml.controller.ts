import { Controller, Get } from "@nestjs/common";
import { SamlService } from "./saml.service";

@Controller({version: "1"})
export class SamlController {
    constructor(
        private readonly samlService: SamlService
    ) {}

    @Get("metadata")
    getMetadata() {
        return this.samlService.getMetadata();
    }
}