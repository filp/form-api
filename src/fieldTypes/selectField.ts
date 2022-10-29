import type { ID, WithOptionalArchived } from '../util';
import { Field } from '../field';

// A single choice/option on a select field.
//
// SelectFieldChoice(s) may be archived, removing them from the list of choices
// while preserving connections from existing responses.
export class SelectFieldChoice {
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

  constructor(data: WithOptionalArchived<SelectFieldChoice['data']>) {
    this.data = {
      ...data,
      archived: typeof data.archived === 'undefined' ? false : data.archived,
    };
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

  // Returns all choices for this select field, optionally including archived
  // choices too.
  public getChoices(options: { includeArchived?: boolean } = {}) {
    if (options.includeArchived) {
      return this.choices;
    }

    return this.choices.filter((choice) => !choice.archived);
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
