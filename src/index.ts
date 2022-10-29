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

  public clearLinkedFieldCondition() {
    this.data = {
      ...this.data,
      linkedFieldId: undefined,

      hasValue: undefined,
      matchValueBool: undefined,
      matchValueInt: undefined,
      matchValueStr: undefined,
    };
  }

  // Sets the condition for this field, making its visibility dependent on the
  // state of another field, based on the condition rules argument.
  //
  // In this rough implementation, we look at the runtime type and use that to decide
  // which underlying property to assign it to.
  //
  // This produces some pretty ugly code.
  public setLinkedFieldCondition<MatchValueT>(
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

class SelectFieldChoice {
  public data: {
    id: ID;

    // Linked to the field property entity, to allow users to change the underlying field and
    // have changes propagate safely.
    fieldPropertiesId: ID;
    label: string;
    archived: boolean;
  };

  get id() {
    return this.data.id;
  }

  get archived() {
    return this.data.archived;
  }

  constructor(data: SelectFieldChoice['data']) {
    this.data = data;
  }

  public setArchived() {
    this.data.archived = true;
  }
}

export class SelectField extends Field {
  public readonly properties: {
    defaultChoiceId?: ID;
  };

  public choices: SelectFieldChoice[] = [];

  constructor(data: Field['data'], properties: SelectField['properties']) {
    super(data);
    this.properties = properties;
  }

  public setDefaultChoice(defaultChoice: SelectFieldChoice) {
    const choiceIdx = this.getChoiceIndexById(defaultChoice.id);

    if (choiceIdx === -1) {
      throw new Error(
        `Tried to set SelectChoice(${defaultChoice.id}) as default, does not belong to SelectField(${this.id})`
      );
    }

    if (defaultChoice.archived) {
      throw new Error(
        `Tried to set SelectChoice(${defaultChoice.id}) as default, but is archived`
      );
    }

    this.properties.defaultChoiceId = defaultChoice.id;
  }

  public addChoice(choice: SelectFieldChoice) {
    if (choice.archived) {
      throw new Error(
        `invariant: adding SelectFieldChoice(${choice.id}) to SelectField(${this.id}), but is already archived`
      );
    }

    this.choices.push(choice);

    return choice;
  }

  public removeChoice(choice: SelectFieldChoice) {
    if (!this.hasChoice(choice)) {
      throw new Error(
        `Tried to archive SelectChoice(${choice.id}), does not belong to SelectField(${this.id})`
      );
    }

    choice.setArchived();
  }

  public hasChoice(choice: SelectFieldChoice) {
    const choiceIdx = this.getChoiceIndexById(choice.id);

    return choiceIdx !== -1;
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

  get id() {
    return this.data.id;
  }

  constructor(data: Form['data']) {
    this.data = data;
  }

  // Soft-removes a field from this form by marking it as archived.
  //
  // NOTE: Archiving a field severs conditions between fields.
  public removeField(field: Field) {
    if (!this.hasField(field)) {
      throw new Error(
        `Tried to archive Field(${field.id}), does not belong to Form(${this.data.id})`
      );
    }

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
        relatedField.clearLinkedFieldCondition();
      }
    });
  }

  public addField(field: Field) {
    if (field.archived) {
      throw new Error(
        `invariant: adding Field(${field.id}) to Form(${this.id}), but is already archived`
      );
    }

    this.fields.push(field);
  }

  public hasField(field: Field) {
    const fieldIdx = this.getFieldIndexById(field.id);
    return fieldIdx !== -1;
  }

  // Gets all non-archived fields for this Form, in the order they were added.
  public getFields(options: { includeArchived?: boolean } = {}) {
    if (options.includeArchived) {
      return this.fields;
    }

    return this.fields.filter((field) => !field.archived);
  }

  private getFieldIndexById(fieldId: ID) {
    return this.fields.findIndex((field) => field.id === fieldId);
  }
}
