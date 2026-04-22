import {pako} from "pako";
import { XmlAttributeFields } from "src/types";
import { xml2js } from "xml-js";

export const inflateXml = (xml: string): string => {
    const decoded = Buffer.from(xml, 'base64');
    return pako.inflateRaw(decoded, { to: 'string' });
}

export const extractXmlAttributeFields = (inflatedXml: string, attributeFields: string[]): any => {
    const {elements} = xml2js(inflatedXml);
    const element = elements[0];

    const xmlAttributeFields: XmlAttributeFields = {};
    attributeFields.forEach((attributeField: string) => {
        if(!element.attributes[attributeField]) return
        xmlAttributeFields[attributeField.toLowerCase()] = element.attributes[attributeField];
    });

    return xmlAttributeFields;
}