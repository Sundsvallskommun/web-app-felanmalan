export interface ContactChannelDTO {
  type: string;
  value: string;
}

export interface StakeholderDTO {
  contactChannels: ContactChannelDTO[];
  role: string;
}

export interface ClassificationDTO {
  category: string;
  type: string;
}

export interface ParameterDTO {
  key: string;
  values: string[];
}

export interface CreateErrandPayload {
  title: string;
  description?: string;
  classification: ClassificationDTO;
  priority: string;
  stakeholders?: StakeholderDTO[];
  parameters?: ParameterDTO[];
}
