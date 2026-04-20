import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { UserService } from "../users/user.service";
import { LoginRequest, SamlRequestData } from "src/types";
import { extractXmlAttributeFields, inflateXml } from "src/utils";

@Injectable()
export class SamlService {
    private readonly logger = new Logger(SamlService.name);
    constructor(
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
    ) {}

    async parseSamlRequest({samlRequestData}: {samlRequestData: SamlRequestData}): Promise<LoginRequest> {
        const inflatedXaml = inflateXml(samlRequestData.samlRequest);
        const loginData = extractXmlAttributeFields(inflatedXaml, ['AssertionConsumerServiceURL', 'ID']);
        return {
            id: loginData.id,
            assertionConsumerServiceUrl: loginData.assertionconsumerserviceurl,
            relayState: samlRequestData.relayState,
            userData: samlRequestData.user
        };
    }

    
} 
 