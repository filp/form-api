import uniqid from 'uniqid';

type ID = string;
type MimeTypeLike =
  | 'application'
  | 'audio'
  | 'font'
  | 'image'
  | 'model'
  | 'text'
  | 'video'
  | `${string}/${string}`;

type FieldConditionOptions<MatchValueT> = Pick<Field['data'], 'hasValue'> & {
  matchValue: MatchValueT;
};

abstract class Field {
  public data: {
    id: ID;
    formId: ID;
    fieldPropertiesId: ID;
    name: string;
    label: string;
    description?: string;
    archived: boolean;
    type: 'text' | 'boolean' | 'select' | 'file';
    linkedFieldId?: ID;
    hasValue?: boolean;
    matchValueStr?: string;
    matchValueInt?: number;
    matchValueBool?: boolean;
  };

  get id(): ID {
    return this.data.id;
  }

  get archived() {
    return this.data.archived;
  }

  constructor(data: Field['data']) {
    this.data = data;
  }

  public setArchived() {
    this.data.archived = true;
  }

  public clearCondition() {
    this.data = {
      ...this.data,
      linkedFieldId: undefined,

      hasValue: undefined,
      matchValueBool: undefined,
      matchValueInt: undefined,
      matchValueStr: undefined,
    };
  }

  // Adds a condition for this field, making its visibility dependent on the
  // state of another field, based on the condition rules argument.
  //
  // In this rough implementation, we look at the runtime type and use that to decide
  // which underlying property to assign it to.
  //
  // This produces some pretty ugly code.
  public addCondition<MatchValueT>(
    linkedField: Field,
    condition: FieldConditionOptions<MatchValueT>
  ) {
    const { matchValue, ...conditionProperties } = condition;

    const conditionMatchProperties = {
      matchValueInt:
        matchValue && typeof matchValue === 'number' ? matchValue : undefined,
      matchValueStr:
        matchValue && typeof matchValue === 'string' ? matchValue : undefined,
      matchValueBool:
        matchValue && typeof matchValue === 'boolean' ? matchValue : undefined,
    };

    this.data = {
      ...this.data,
      linkedFieldId: linkedField.id,
      ...conditionProperties,
      ...conditionMatchProperties,
    };
  }

  // Fields must implement a validation routine for user submitted values
  public abstract isValidValue(value: unknown): boolean;
}

export class TextField extends Field {
  public readonly properties: {
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

export class BooleanField extends Field {
  public readonly properties: {
    defaultValue?: boolean;
  };

  constructor(data: Field['data'], properties: BooleanField['properties']) {
    super(data);
    this.properties = properties;
  }

  // At this point in our application stack we would have already
  // validated that our value is indeed a boolean; implementation
  // left here just as an example.
  public isValidValue(value: boolean) {
    return typeof value === 'boolean';
  }
}

type SelectFieldChoice = {
  id: ID;

  // Linked to the field property entity, to allow users to change the underlying field and
  // have changes propagate safely.
  fieldPropertiesId: ID;
  label: string;
};

export class SelectField extends Field {
  public readonly properties: {
    defaultChoiceId?: ID;
  };

  public choices: SelectFieldChoice[] = [];

  constructor(data: Field['data'], properties: SelectField['properties']) {
    super(data);
    this.properties = properties;
  }

  public addChoice(choice: Omit<SelectFieldChoice, 'id'>) {
    this.choices.push({
      id: uniqid(),
      ...choice,
    });
  }

  public removeChoice(choiceId: ID) {
    const choiceIdx = this.getChoiceIndexById(choiceId);

    if (choiceIdx === -1) {
      throw new Error(
        `Tried to remove SelectChoice(${choiceId}), does not belong to SelectField(${this.id})`
      );
    }

    delete this.choices[choiceIdx];
  }

  public isValidValue(choiceId: string) {
    const choiceIdx = this.getChoiceIndexById(choiceId);

    // Not a valid SelectFieldChoice ID, or one that's not part of
    // this field.
    return choiceIdx === -1;
  }

  private getChoiceIndexById(choiceId: ID) {
    return this.choices.findIndex((choice) => choice.id === choiceId);
  }
}

export class FileField extends Field {
  public readonly properties: {
    maxSizeBytes?: number;
    validExtensions?: `.${string}`[];
    validMimeTypes?: MimeTypeLike[];
  };

  constructor(data: Field['data'], properties: FileField['properties']) {
    super(data);
    this.properties = properties;
  }

  // Validating files is beyond the scope of this implementation. For funsies,
  // we use a Buffer as an example and check its byte length.
  public isValidValue(value: Buffer) {
    const { maxSizeBytes } = this.properties;

    if (typeof maxSizeBytes !== 'undefined') {
      return Buffer.byteLength(value) <= maxSizeBytes;
    }

    return true;
  }
}

export class Form {
  public data: {
    id: ID;
    title: string;
    description?: string;
    archived: boolean;
  };

  public fields: Field[] = [];

  constructor(data: Form['data']) {
    this.data = data;
  }

  public removeField(fieldId: ID) {
    const fieldIdx = this.getFieldIndexById(fieldId);

    if (fieldIdx === -1) {
      throw new Error(
        `Tried to remove Field(${fieldId}), does not belong to Form(${this.data.id})`
      );
    }

    const field = this.fields[fieldIdx];

    // Mark our field as archived.
    //
    // In a real-world scenario we would possibly check if there were any responses on this
    // field, and hard-delete it if not.
    field.setArchived();

    // Handle fields that have a condition on this one. In this case we clear the condition,
    // but since the Field entity is just archived, we could handle it more gracefully (e.g
    // just showing a warning in the interface, with the option to undo the archival).
    this.fields.forEach((relatedField) => {
      if (relatedField.data.linkedFieldId === field.id) {
        relatedField.clearCondition();
      }
    });
  }

  public addField(field: Field) {
    this.fields.push(field);
  }

  // Gets all non-archived fields for this Form, in the order they were added.
  public getFields() {
    return this.fields.filter((field) => !field.archived);
  }

  private getFieldIndexById(fieldId: ID) {
    return this.fields.findIndex((field) => field.id === fieldId);
  }
}
