import { Field } from '../field';

export class BooleanField extends Field {
  public properties: {
    defaultValue?: boolean;
  };

  constructor(data: Field['data'], properties: BooleanField['properties']) {
    super(data);
    this.properties = properties;
  }

  public setDefault(defaultValue: boolean) {
    this.properties.defaultValue = defaultValue;
  }

  // At this point in our application stack we would have already
  // validated that our value is indeed a boolean; implementation
  // left here just as an example.
  public isValidValue(value: boolean) {
    return typeof value === 'boolean';
  }
}
