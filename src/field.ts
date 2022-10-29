import type { ID, WithOptionalArchived } from './util';

type FieldConditionOptions<MatchValueT> = Pick<Field['data'], 'hasValue'> & {
  matchValue: MatchValueT;
};

export abstract class Field {
  public data: {
    id: ID;
    formId: ID;
    fieldPropertiesId: ID;
    name: string;
    label: string;
    description?: string;
    archived: boolean;
    // TODO: Build this union dynamically from available field types?
    type: 'text' | 'boolean' | 'select' | 'file';
    required?: boolean;
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

  constructor(data: WithOptionalArchived<Field['data']>) {
    this.data = {
      ...data,
      archived: typeof data.archived === 'undefined' ? false : data.archived,
    };
  }

  public setArchived() {
    this.data.archived = true;
  }

  // Clears properties on this field related to linked field conditions.
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
    if (this.data.formId !== linkedField.data.formId || linkedField.archived) {
      throw new Error(
        'Cannot set linked field condition on an archived field, or fields in another form'
      );
    }

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
