import type {HTMLTemplateResult} from 'lit';

export type LabelValue = {
  label: string;
  value: string;
  checked?: boolean;
}

type SurveyFieldBase = {
  required?: boolean;
  label?: string;
  defaultValue?: string;
  id: string;
};

export type SurveyInput = SurveyFieldBase & {
  type: 'input';
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  inputType?: 'text' | 'number' | 'date';
};

export type SurveyTextarea = Omit<SurveyInput, 'type' | 'inputType'> & {
  type: 'textarea';
  rows?: number;
};

type OptionsFunction = () => Promise<{label: string; value: string}[]>;

export type SurveySelect = SurveyFieldBase & {
  type: 'select';
  options: LabelValue[] | OptionsFunction;
};

export type SurveyRadio = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'radio';
  defaultValue: string;
  options: LabelValue[] | OptionsFunction;
};

export type SurveyCheckbox = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'checkbox';
  options: LabelValue[] | OptionsFunction;
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
};

export interface SurveyConditional {
  visible: (fields: SurveyField[]) => boolean;
  children: SurveyField[];
}

export interface SurveyComputed {
  render: (fields: SurveyField[]) => HTMLTemplateResult;
}

export type SurveyField =
  | SurveyInput
  | SurveyTextarea
  | SurveySelect
  | SurveyRadio
  | SurveyCheckbox
  | SurveyCoords
  | SurveyFile
  | SurveyId;
// | SurveyConditional;
