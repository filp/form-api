import { Field } from '../field';

export class TextField extends Field {
  public properties: {
    // Can be used for validation, but also for special behaviors & ui:
    format: 'text' | 'text-box' | 'email' | 'url';
    minLength?: number;
    maxLength?: number;
    placeholder?: string;
    defaultValue?: string;
  };

  constructor(data: Field['data'], properties: TextField['properties']) {
    super(data);
    this.properties = properties;
  }

  public setDefault(defaultValue: string) {
    if (!this.isValidValue(defaultValue)) {
      throw new Error(
        'Cannot set default value for TextField; default does not pass validation'
      );
    }

    this.properties.defaultValue = defaultValue;
  }

  // Validates a text field value against the validation options.
  // NOTE: Ignores format for this implementation; format could be used to, e.g
  //       ensure something looks like an email address, URL, etc.
  public isValidValue(value: string) {
    const { minLength, maxLength } = this.properties;

    // Too short:
    if (typeof minLength !== 'undefined' && value.length < minLength) {
      return false;
    }

    // Too long:
    if (typeof maxLength !== 'undefined' && value.length > maxLength) {
      return false;
    }

    return true;
  }
}
