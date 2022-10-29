import { Field } from '../field';

type MimeTypeLike =
  | 'application'
  | 'audio'
  | 'font'
  | 'image'
  | 'model'
  | 'text'
  | 'video'
  | `${string}/${string}`;

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
