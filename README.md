# form-api

An interface & data model for defining user-created forms, and accepting form submissions.

# API

The following example outlines creating a form, adding fields to that form, and setting conditions between fields:

```ts
const form = new Form({
  id: 'legit-form-from-ur-bank',
  title: 'Super Legit Form',
  description: 'This is a legit and not suspicious form',
});

const cardNumberField = new TextField({
  name: 'credit_card',
  format: 'text',
  label: 'Credit Card Number',
  maxLength: 16,
  required: true,
});

const passportPhoto = new FileField({
  name: 'passport_photo',
  label: 'Photo of your Passport',
  validMimeTypes: ['image/jpeg', 'image/png'],
  validExtensions: ['.jpg', '.png'],
  required: true,
});

const email = new TextField({
  name: 'email',
  label: 'Your Email',
  format: 'email',
});

const subscribeNewsletterCheckbox = new BooleanField({
  name: 'subscribe_newsletter',
  label: 'Subscribe to our newsletter?',
  defaultValue: true,
});

// Only show the checkbox to subscribe to our newsletter if the user provided
// their email.
subscribeNewsletterCheckbox.setLinkedFieldCondition(email, {
  hasValue: true,
});

const emailCadence = new SelectField({
  name: 'email_cadence',
  label: 'How often can we send you emails?',
});

const everyDayCadence = emailCadence.addChoice(
  new SelectFieldChoice({
    id: 'every_day',
    label: 'Every single day',
  })
);

emailCadence.setDefaultChoice(everyDayCadence);

// Only show the cadence selector if the user answered yes on the checkbox:
emailCadence.setLinkedFieldCondition(subscribeNewsletterCheckbox, {
  matchValue: true,
});

form.addField(cardNumberField);
form.addField(passportPhoto);
form.addField(email);
form.addField(subscribeNewsletterCheckbox);
form.addField(emailCadence);
```

# Data Model

The form data model maps the workflow from creating a form and its fields, to accepting submissions. The entities and their relationships are roughly:

- A Form has many fields
- Fields have normalized properties common across all field types, and a field type
- Field types map to seperate tables with additional normalized properties for the field
  - For example, a Field with 'text' type is mapped to a TextFieldProperties with properties such as maximum length for the field, formatting rules, etc
- The act of submitting a response to a Form is tracked through a FormResponse entity
- The contents of the individual form fields in a response are tracked across tables for the various data types
  - For example, a file uploaded through a File field is tracked in a FileFieldResponse, and includes properties such as the file name, its remote URI (such as an S3 key), and its mime type

## Pseudo-schema

_Note:_ relevant time-stamp fields are omitted for brevity, e.g createdAt, updatedAt, archivedAt

```r
Form:
  id                ID
  title             string     -- the title for this Form
  description?      string     -- an optional longer description for this Form
  archived          boolean    -- is this Form archived, or is it accepting new submissions?

Field:
  id                ID
  fieldPropertiesId ID         -- ID for the related <FieldType>FieldProperties
  formId            ID         -- ID for the Form this field belongs to
  name              string     -- name for this Field; may be updated, and must be unique within the Form
  label             string     -- human-readable label for this Field
  description?      string     -- an optional longer description for this Field
  archived          boolean    -- is this Field archived, because it was soft-deleted?
  type              FieldType  -- an enum value indicating the type of field (see FieldType)
  linkedFieldId?    ID         -- ID for the conditioning Field
  hasValue?         boolean    -- field is visible when conditioning field has any value
  matchValueStr?    string     -- field is visible when string value matches
  matchValueBool?   boolean    -- field is visible when boolean value matches
  matchValueInt?    number     -- field is visible when number value matches

ENUM FieldType: => text | boolean | select | file | ...

TextFieldProperties:
  id                ID
  fieldId           ID         -- ID for the related Field
  format            TextFormat -- the format validation rule for this text field (see TextFormat)
  minLength?        number     -- optional minimum length for this text field
  maxLength?        number     -- optional maximum length for this text field
  placeholder?      string     -- an optional placeholder value for this text field
  defaultValue?     string     -- an optional default value for this text field

ENUM TextFormat: => text | text-box | email | url ...

BooleanFieldProperties:
  id                ID
  fieldId           ID         -- ID for the related Field
  defaultValue?     boolean    -- an optional default value for this text field

SelectFieldProperties:
  id                ID
  fieldId           ID         -- ID for the related Field
  defaultChoiceId?  ID         -- an optional ID for the default SelectFieldChoice for this Field

SelectFieldChoice:
  id                ID
  fieldPropertiesID ID         -- ID for the related SelectFieldProperties
  label             string     -- human-readable label for this selection choice
  archived          boolean    -- is this SelectFieldChoice archived, because it was soft-deleted?

FileFieldProperties:
  id                ID
  fieldId           ID         -- ID for the related Field
  validMimeTypes?   string[]   -- an optional list of mime types to match this file field against
  validExtensions?  string[]   -- an optional list of file extensions to match this file field against
  maxSizeBytes?     number     -- an optional maximum size in bytes for uploaded files

FormResponse:
  id                ID
  formId            ID         -- ID for the Form this FormResponse relates to
  submitterId?      ID         -- optional ID of the user that submitted this FormResponse

TextFieldResponse:
  id                ID
  formResponseId    ID         -- ID for the related FormResponse
  fieldId           ID         -- ID for the related Field
  value             string     -- text content for this response, on this field

BooleanFieldResponse:
  id                ID
  formResponseId    ID         -- ID for the related FormResponse
  fieldId           ID         -- ID for the related Field
  value             boolean    -- boolean value for this response, on this field

SelectFieldResponse:
  id                ID
  formResponseId    ID         -- ID for the related FormResponse
  fieldId           ID         -- ID for the related Field
  selectChoiceId    ID         -- ID for the selected SelectFieldChoice

FileFieldResponse:
  id                ID
  formResponseId    ID         -- ID for the related FormResponse
  fieldId           ID         -- ID for the related Field
  uri               string     -- URI to locate the uploaded file (e.g s3 URI)
  fileName          string     -- original file name for the uploaded file
  fileSize          number     -- file size for the uploaded file
  mimeType          string     -- mime type for the uploaded file
```

## Fields & field properties

Fields are represented by two entities: a field container entity, and a set of properties for the type of field.

The field container includes shared field information, such as a label, an optional description, as well as things like if the field was archived.

The per-field-type properties entity allows fields to include complex, type safe, native properties that apply to that specific field and type only.

For example, the FileFieldProperties entity accepts user-defined options for valid mime types, allowed file extensions, and user-defined maximum file size:

```r
FileFieldProperties:
  ...
  validMimeTypes?   string[]   -- an optional list of mime types to match this file field against
  validExtensions?  string[]   -- an optional list of file extensions to match this file field against
  maxSizeBytes?     number     -- an optional maximum size in bytes for uploaded files
```

## Conditional fields

Conditional fields are represented by a set of normalized properties within the `Field` entity:

```r
Field:
  ...
  linkedFieldId?    ID         -- ID for the conditioning Field
  hasValue?         boolean    -- field is visible when conditioning field has any value
  matchValueStr?    string     -- field is visible when string value matches
  matchValueBool?   boolean    -- field is visible when boolean value matches
  matchValueInt?    number     -- field is visible when number value matches
```

This approach is a least-effort compromise for handling field relationships and, more specifically,
field visibility based on a linked field's value.

We use the field's type to match against an appropriate scalar type property. For example, we can
map against a boolean field type using `matchValueBool`, and against a text field with `matchValueStr`.

### Pros of this approach:

- Low effort, pragmatic
- Normalized, likely performant for most cases, and benefits from native data types
- Allows multiple fields to have a conditional relationship with the same field
- Easy to track the relationship between conditional values and their conditioners
- Easy to manage value matching for most field types
- Easy to migrate to a more robust approach later on

### Cons of this approach:

- Column layout feels unnatural, and requires additional steps to get a 'real' value for the match value
- Deleting a field requires severing the relationship by updating linking fields
- Somewhat breaks responsibility boundaries for the Field entity
- A field can only be conditioned by a single other field

### Alternate approaches to consider:

_Tracking relationships as first-class entity:_

This approach may be the natural progression of the proposed solution. We can use separate entities to map the conditional relationship between fields, potentially for each field type, or field value scalar type.

Tracking conditional relationships with entities for each field type makes it possible to setup interesting scenarios, for example:

- A field that only becomes available if a user uploaded an image with certain dimensions
- A form that accepts youtube or vimeo links, and has different flows for either scenario

This wasn't the chosen approach since it doesn't fit a clear project need at the moment, and introduces considerable complexity/boilerplate.

_Sub-object field for match values:_

A sub-object field (e.g JSONB) arguably resolves most of the column "ickyness" around match values, but potentially introduces type safety issues (which can be solved with, for example, JSON schema).

_Tracking match values on linked field_

Inverting the relationship so the conditional field's match value is tracked by the linked field instead solves the type issues, since we can benefit from the individual field type tables & columns. This however introduces a weird relationship between entities, and prevents multiple fields from being conditioned by the same field.

## Form responses

Responses to a form are represented by a first-class response entity, which holds metadata on the form submission (e.g who, when), as well as acting as a container for the responses to the individual fields in a form.

The container approach also makes it easy to naturally handle multiple submissions by the same user, as well as across different versions of the same form.

The contents of each field in the user's submission are individually tracked in different entities depending on the field's type. This adds a complex layer of indirection, but allows us to naturally map and enrich this content.

For example, the details on a file uploaded by a user can be tracked using a `FileFieldResponse`, including the original file name, its mime type, and where to find it after it was uploaded.

```r
FileFieldResponse:
  id                ID
  formResponseId    ID         -- ID for the related FormResponse
  fieldId           ID         -- ID for the related Field
  uri               string     -- URI to locate the uploaded file (e.g s3 URI)
  fileName          string     -- original file name for the uploaded file
  fileSize          number     -- file size for the uploaded file
  mimeType          string     -- mime type for the uploaded file
```

Additionally, the individual field response object allows us to handle submissions to since-removed form fields appropriately, in conjunction with a field's `archived` property.

## Next steps, ideas, and notes:

- Ordering fields is not supported in the current data model. Could be implemented through a sort weight property on Field or similar approach.
- Conditional fields are implemented using a compromise approach, with a path for migration if necessary.
- Extracting `TextField` into discrete types for `url`, `email`, etc could be interesting, e.g:
  - Gather, cache, and display rich metadata on URLs
  - Enrich and provide quick contextual actions for email addresses
- Using a single column for `text` and `text-box` responses means using an underlying data type that isn't ideal for both
- Form fields can be safely removed and added after submissions have been received, however, there's no native versioning support. We can use the same container entity approach as `FormResponse` to support form versioning.
- Select field choices do not allow the user to define a value distinct from the label. Is there a need for this option?
- Not responding on non-required fields does not produce any trace other than the absence of a response on that field. Is that sufficient, or is there a valid use-case for more-explicitly tracking skipped fields?
