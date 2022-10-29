import type { ID, WithOptionalArchived } from './util';
import type { Field } from './field';

export { BooleanField } from './fieldTypes/booleanField';
export { FileField } from './fieldTypes/fileField';
export { TextField } from './fieldTypes/textField';
export { SelectField, SelectFieldChoice } from './fieldTypes/selectField';

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

  constructor(data: WithOptionalArchived<Form['data']>) {
    this.data = {
      ...data,
      archived: typeof data.archived === 'undefined' ? false : data.archived,
    };
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
