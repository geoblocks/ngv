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

export type SurveySelect = SurveyFieldBase & {
  type: 'select';
  options: {label: string; value: string}[];
};

export type SurveyRadio = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'radio';
  defaultValue: string;
  options: {label: string; value: string}[];
};

export type SurveyCheckbox = Omit<SurveyFieldBase, 'defaultValue'> & {
  type: 'checkbox';
  options: {label: string; value: string; checked: boolean}[];
};

export type SurveyField =
  | SurveyInput
  | SurveyTextarea
  | SurveySelect
  | SurveyRadio
  | SurveyCheckbox;
