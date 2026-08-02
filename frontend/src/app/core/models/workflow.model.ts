export interface IWorkflowStep {
  id: string;
  stepCode: string;
  stepNameTh: string;
  stepNameEn: string;
  stepOrder: number;
  colorCode: string | null;
  isTerminal: boolean;
}

export interface IWorkflowTransition {
  id: string;
  fromStepId: string | null;
  toStepId: string;
  conditionKey: string | null;
  label: string | null;
}

export interface IWorkflowTemplateStructure {
  id: string;
  code: string;
  steps: IWorkflowStep[];
  transitions: IWorkflowTransition[];
}
