import type {FieldValues} from '../../utils/generalTypes.js';

export type LabelValue = {
  label: string;
  value: string;
  checked?: boolean;
};

type DefaultValueFunction = (...args: any[]) => string;

type SurveyFieldBase = {
  required?: boolean;
  label?: string;
  defaultValue?: string | DefaultValueFunction;
  id: string;
};

export type SurveyInput = SurveyFieldBase & {
  type: 'input';
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  inputType?: 'text' | 'number' | 'date' | 'datetime-local';
  valueCallback?: (value: FieldValues) => string;
  disabled?: boolean;
};

export type SurveyColorpicker = SurveyFieldBase & {
  type: 'color';
  valueCallback?: (value: FieldValues) => string;
  disabled?: boolean;
};

export type SurveyTextarea = Omit<SurveyInput, 'type' | 'inputType'> & {
  type: 'textarea';
  rows?: number;
};

export type FieldOptions = LabelValue[] | Record<string, LabelValue[]>;

type OptionsFunction = () => Promise<FieldOptions>;

export type SurveySelect = SurveyFieldBase & {
  type: 'select';
  options?: FieldOptions | OptionsFunction;
  keyPropId?: string;
  keyCallback?: (value: FieldValues) => string;
};

export type SurveyRadio = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'radio';
  defaultValue: string;
  options?: FieldOptions | OptionsFunction;
  keyPropId?: string;
  keyCallback?: (value: FieldValues) => string;
};

export type SurveyCheckbox = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'checkbox';
  options?: FieldOptions | OptionsFunction;
  keyPropId?: string;
  keyCallback?: (value: FieldValues) => string;
};

export type SurveyCoords = SurveyFieldBase & {
  type: 'coordinates';
};

export type SurveyFile = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'file';
  accept?: string;
  urlInput?: boolean;
  urlPlaceholderText?: string;
  fileInput?: boolean;
  mainBtnText?: string;
  uploadBtnText?: string;
};

export type SurveyId = Omit<SurveyFieldBase, 'required' | 'defaultValue'> & {
  type: 'id';
  hidden?: boolean;
};

type ReadonlyOptionsFunction = () => Promise<Record<string, string>>;

export type SurveyReadonly = Omit<SurveyFieldBase, 'required'> & {
  type: 'readonly';
  options?: Record<string, string> | ReadonlyOptionsFunction;
  keyPropId?: string;
  keyCallback?: (...args: any[]) => string;
  hidden?: boolean;
};

export type SurveyField =
  | SurveyInput
  | SurveyTextarea
  | SurveySelect
  | SurveyRadio
  | SurveyCheckbox
  | SurveyCoords
  | SurveyFile
  | SurveyId
  | SurveyReadonly
  | SurveyColorpicker;
