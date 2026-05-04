import { hash } from 'crypto';
import ejs from 'ejs';
import { readFileSync } from 'fs';
import pako from 'pako';
import { XmlAttributeFields } from 'src/types';
import { xml2js } from 'xml-js';

export const inflateXml = (xml: string): string => {
  const decoded = Buffer.from(xml, 'base64');
  return pako.inflateRaw(decoded, { to: 'string' });
};

export const extractXmlAttributeFields = (
  inflatedXml: string,
  attributeFields: string[],
): any => {
  const { elements } = xml2js(inflatedXml);
  const element = elements[0];

  const xmlAttributeFields: XmlAttributeFields = {};
  attributeFields.forEach((attributeField: string) => {
    if (!element.attributes[attributeField]) return;
    xmlAttributeFields[attributeField.toLowerCase()] =
      element.attributes[attributeField];
  });

  return xmlAttributeFields;
};

export const extractSamlAttributeFields = (
  inflatedXml: string,
  attributeFields: string[],
): any => {
  const { elements } = xml2js(inflatedXml);
  const samlAttributeFields: XmlAttributeFields = {};
  const requestedAttributeFields = new Set(
    attributeFields.map((field) => field.toLowerCase()),
  );

  const walkElements = (nodes: any[]): void => {
    for (const node of nodes) {
      if (node?.type !== 'element') {
        continue;
      }

      const nodeName = normalizeElementName(node.name);
      if (nodeName === 'Attribute' && node.attributes?.Name) {
        const attributeName = String(node.attributes.Name).toLowerCase();
        if (
          requestedAttributeFields.has(attributeName) &&
          !samlAttributeFields[attributeName]
        ) {
          const attributeValue = extractAttributeValue(node);
          if (attributeValue) {
            samlAttributeFields[attributeName] = attributeValue;
          }
        }
      }

      if (node.elements && Array.isArray(node.elements)) {
        walkElements(node.elements);
      }
    }
  };

  if (elements && Array.isArray(elements)) {
    walkElements(elements);
  }

  return samlAttributeFields;
};

export const buildFromTemplate = ({
  templatePath,
  data,
}: {
  templatePath: string;
  data: Record<string, any>;
}): string => {
  const template = readFileSync(templatePath, 'utf-8');
  const compiledTemplate = ejs.compile(template);
  return compiledTemplate(data);
};

export const hashPassword = (password: string): string => {
  return hash('sha256', password);
};

export const wrapInAutoSubmitForm = (
  samlResponse: string,
  acsUrl: string,
): string => {
  return buildFromTemplate({
    templatePath: 'src/templates/auto_submit_form.ejs',
    data: { samlResponse, acsUrl },
  });
};

const normalizeElementName = (name?: string): string => {
  if (!name) return '';
  return name.includes(':') ? (name.split(':').pop() ?? name) : name;
};

const decodeXmlEntities = (value: string): string => {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const extractAttributeValue = (node: any): string | undefined => {
  if (!node?.elements || !Array.isArray(node.elements)) {
    return undefined;
  }

  const attributeValueElement = node.elements.find(
    (child: any) =>
      child?.type === 'element' &&
      normalizeElementName(child.name) === 'AttributeValue',
  );

  if (!attributeValueElement?.elements) {
    return undefined;
  }

  const textNode = attributeValueElement.elements.find(
    (child: any) => child?.type === 'text' || child?.type === 'cdata',
  );

  if (!textNode?.text && !textNode?.cdata) {
    return undefined;
  }

  return decodeXmlEntities((textNode.text ?? textNode.cdata).trim());
};
